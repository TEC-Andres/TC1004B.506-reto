#include "YRM100.h"

namespace {

// Field selector for the "get module info" command.
constexpr uint8_t kInfoHardwareVersion = 0x00;
constexpr uint8_t kInfoSoftwareVersion = 0x01;
constexpr uint8_t kInfoManufacturer = 0x02;

// Inventory sub-command required by the multi-inventory command.
constexpr uint8_t kInventoryReserved = 0x22;

// Bit offset of the EPC inside the EPC bank (skips the CRC and PC words).
constexpr uint32_t kEpcStartBit = 0x20;

}  // namespace

// Tag
String YRM100::Tag::epcHex() const {
    static const char kDigits[] = "0123456789ABCDEF";
    String hex;
    hex.reserve(epcLength * 2);
    for (uint8_t i = 0; i < epcLength; i++) {
        hex += kDigits[epc[i] >> 4];
        hex += kDigits[epc[i] & 0x0F];
    }
    return hex;
}

bool YRM100::Tag::epcEquals(const uint8_t* other, size_t length) const {
    return length == epcLength && memcmp(epc, other, length) == 0;
}

// Setup and module information
YRM100::YRM100(Stream& serial) : serial_(serial) {}

bool YRM100::begin() {
    return hardwareVersion().length() > 0;
}

String YRM100::hardwareVersion() { return readModuleInfo(kInfoHardwareVersion); }
String YRM100::softwareVersion() { return readModuleInfo(kInfoSoftwareVersion); }
String YRM100::manufacturer() { return readModuleInfo(kInfoManufacturer); }

String YRM100::readModuleInfo(uint8_t field) {
    if (!sendCommand(kCmdModuleInfo, &field, 1) || rx_.length < 1) {
        return String();
    }
    // Response: [field][ASCII text...]
    String text;
    text.reserve(rx_.length - 1);
    for (uint16_t i = 1; i < rx_.length; i++) {
        text += static_cast<char>(rx_.params[i]);
    }
    return text;
}

// Inventory
size_t YRM100::readSingle(Tag* tags, size_t maxTags, uint32_t timeoutMs) {
    lastError_ = 0;
    sendFrame(kCmdInventory, nullptr, 0);

    // Each tag arrives as its own notification and there is no end-of-round
    // marker, so stop once the module goes quiet after the last tag.
    size_t count = 0;
    const uint32_t start = millis();
    while (true) {
        const uint32_t elapsed = millis() - start;
        if (elapsed >= timeoutMs) break;

        uint32_t wait = timeoutMs - elapsed;
        if (count > 0 && wait > kTagGapMs) wait = kTagGapMs;
        if (!readFrame(wait)) break;

        if (rx_.type == kTypeResponse && rx_.command == kCmdError) {
            lastError_ = rx_.params[0];  // usually "no tag"
            break;
        }

        Tag tag;
        if (count < maxTags && parseTag(rx_, tag)) {
            tags[count++] = tag;
        }
    }
    return count;
}

void YRM100::startContinuousRead(uint16_t rounds) {
    uint8_t params[3] = {kInventoryReserved};
    putU16(&params[1], rounds);
    sendFrame(kCmdMultiInventory, params, sizeof(params));
}

bool YRM100::stopContinuousRead() {
    return sendSimple(kCmdStopInventory, nullptr, 0);
}

bool YRM100::poll(Tag& tag) {
    while (serial_.available()) {
        if (!receiveByte(serial_.read())) continue;

        if (parseTag(rx_, tag)) return true;
        if (rx_.type == kTypeResponse && rx_.command == kCmdError) {
            lastError_ = rx_.params[0];
        }
    }
    return false;
}

bool YRM100::parseTag(const Frame& frame, Tag& tag) {
    // Notification params: [RSSI][PC x2][EPC x n][CRC x2]
    constexpr uint16_t kOverhead = 5;
    if (frame.type != kTypeNotification || frame.command != kCmdInventory ||
        frame.length < kOverhead) {
        return false;
    }

    const uint8_t* p = frame.params;
    const uint16_t epcLength = frame.length - kOverhead;

    tag.rssi = static_cast<int8_t>(p[0]);
    tag.pc = (p[1] << 8) | p[2];
    tag.epcLength = min<uint16_t>(epcLength, kMaxEpcBytes);
    memcpy(tag.epc, &p[3], tag.epcLength);
    tag.crc = (p[3 + epcLength] << 8) | p[4 + epcLength];
    return true;
}

// Tag memory
YRM100::Status YRM100::readMemory(MemoryBank bank, uint16_t wordAddress, uint16_t wordCount,
                                  uint8_t* data, uint32_t accessPassword) {
    const size_t byteCount = wordCount * 2u;
    if (wordCount == 0 || byteCount > kMaxParamBytes) return Status::InvalidArgument;

    // [password x4][bank][address x2][word count x2]
    uint8_t params[9];
    putU32(&params[0], accessPassword);
    params[4] = static_cast<uint8_t>(bank);
    putU16(&params[5], wordAddress);
    putU16(&params[7], wordCount);

    const Status status = accessTag(kCmdReadData, params, sizeof(params));
    if (status != Status::Ok) return status;

    // Response: [UL][PC + EPC x UL][data...]
    const uint16_t dataOffset = 1 + rx_.params[0];
    if (rx_.length < dataOffset + byteCount) return Status::ModuleError;

    memcpy(data, &rx_.params[dataOffset], byteCount);
    return Status::Ok;
}

YRM100::Status YRM100::writeMemory(MemoryBank bank, uint16_t wordAddress, uint16_t wordCount,
                                   const uint8_t* data, uint32_t accessPassword) {
    constexpr size_t kHeaderBytes = 9;
    const size_t byteCount = wordCount * 2u;
    if (wordCount == 0 || kHeaderBytes + byteCount > kMaxParamBytes) {
        return Status::InvalidArgument;
    }

    // [password x4][bank][address x2][word count x2][data...]
    uint8_t params[kMaxParamBytes];
    putU32(&params[0], accessPassword);
    params[4] = static_cast<uint8_t>(bank);
    putU16(&params[5], wordAddress);
    putU16(&params[7], wordCount);
    memcpy(&params[kHeaderBytes], data, byteCount);

    return accessTag(kCmdWriteData, params, kHeaderBytes + byteCount);
}

YRM100::Status YRM100::writeEpc(const uint8_t* epc, size_t length, uint32_t accessPassword) {
    if (length == 0 || length % 2 != 0 || length > kMaxEpcBytes) {
        return Status::InvalidArgument;
    }

    // Write the PC word too: its top 5 bits hold the EPC length in words.
    const uint16_t epcWords = length / 2;
    uint8_t words[2 + kMaxEpcBytes];
    putU16(&words[0], epcWords << 11);
    memcpy(&words[2], epc, length);

    constexpr uint16_t kPcWordAddress = 1;
    return writeMemory(MemoryBank::EPC, kPcWordAddress, epcWords + 1, words, accessPassword);
}

YRM100::Status YRM100::lock(LockArea area, LockAction action, uint32_t accessPassword) {
    // The 20-bit Gen2 lock payload is 10 mask bits followed by 10 action bits,
    // two bits per area (write-lock, permalock), kill password first.
    const uint8_t slot = static_cast<uint8_t>(area);
    const bool permanent =
        action == LockAction::PermanentLock || action == LockAction::PermanentUnlock;
    const bool writeLocked = action == LockAction::Lock || action == LockAction::PermanentLock;

    const uint32_t maskBits = permanent ? 0b11 : 0b10;
    const uint32_t actionBits = (writeLocked ? 0b10 : 0) | (permanent ? 0b01 : 0);
    const uint32_t payload = (maskBits << (18 - 2 * slot)) | (actionBits << (8 - 2 * slot));

    // [password x4][payload x3]
    uint8_t params[7];
    putU32(&params[0], accessPassword);
    params[4] = payload >> 16;
    params[5] = payload >> 8;
    params[6] = payload;

    return accessTag(kCmdLock, params, sizeof(params));
}

YRM100::Status YRM100::kill(uint32_t killPassword) {
    uint8_t params[4];
    putU32(params, killPassword);
    return accessTag(kCmdKill, params, sizeof(params));
}

YRM100::Status YRM100::accessTag(uint8_t command, const uint8_t* params, uint16_t length) {
    if (!sendCommand(command, params, length)) return statusFromError(lastError_);
    return Status::Ok;
}

YRM100::Status YRM100::statusFromError(uint8_t code) const {
    switch (code) {
        case 0:  // sendCommand() timed out
            return Status::Timeout;
        case kErrReadNoTag:
        case kErrWriteNoTag:
        case kErrKillNoTag:
        case kErrLockNoTag:
        case kErrInventoryNoTag:
            return Status::NoTag;
        case kErrAccessPassword:
            return Status::WrongPassword;
        default:
            if (code >= kErrReadTagBase && code <= kErrKillTagBase + 0x0F) {
                return Status::TagError;
            }
            return Status::ModuleError;
    }
}

// Tag selection
bool YRM100::setSelect(MemoryBank bank, uint32_t pointerBits, const uint8_t* mask,
                       uint8_t maskBits, uint8_t target, uint8_t action, bool truncate) {
    const uint8_t maskBytes = (maskBits + 7) / 8;

    // [target|action|bank][pointer x4][mask length][truncate][mask...]
    uint8_t params[7 + 32];
    params[0] = ((target & 0x07) << 5) | ((action & 0x07) << 2) | static_cast<uint8_t>(bank);
    putU32(&params[1], pointerBits);
    params[5] = maskBits;
    params[6] = truncate ? 0x80 : 0x00;
    memcpy(&params[7], mask, maskBytes);

    return sendSimple(kCmdSetSelect, params, 7 + maskBytes);
}

bool YRM100::setSelectMode(SelectMode mode) {
    return sendByte(kCmdSetSelectMode, static_cast<uint8_t>(mode));
}

bool YRM100::selectEpc(const uint8_t* epc, size_t length) {
    if (length == 0 || length * 8 > 0xFF) return false;
    return setSelect(MemoryBank::EPC, kEpcStartBit, epc, length * 8) &&
           setSelectMode(SelectMode::AccessOnly);
}

// RF Management
bool YRM100::setRegion(Region region) {
    return sendByte(kCmdSetRegion, static_cast<uint8_t>(region));
}

bool YRM100::getRegion(Region& region) {
    if (!sendCommand(kCmdGetRegion, nullptr, 0) || rx_.length < 1) return false;
    region = static_cast<Region>(rx_.params[0]);
    return true;
}

bool YRM100::setChannel(uint8_t index) {
    return sendByte(kCmdSetChannel, index);
}

bool YRM100::getChannel(uint8_t& index) {
    if (!sendCommand(kCmdGetChannel, nullptr, 0) || rx_.length < 1) return false;
    index = rx_.params[0];
    return true;
}

bool YRM100::setFrequencyHopping(bool enabled) {
    return sendByte(kCmdSetHopping, enabled ? 0xFF : 0x00);
}

bool YRM100::setTransmitPower(float dBm) {
    // The module works in hundredths of a dBm.
    uint8_t params[2];
    putU16(params, static_cast<uint16_t>(lroundf(dBm * 100.0f)));
    return sendSimple(kCmdSetPower, params, sizeof(params));
}

bool YRM100::getTransmitPower(float& dBm) {
    if (!sendCommand(kCmdGetPower, nullptr, 0) || rx_.length < 2) return false;
    dBm = ((rx_.params[0] << 8) | rx_.params[1]) / 100.0f;
    return true;
}

bool YRM100::setQuery(const QueryParams& query) {
    // [DR:1 M:2 TRext:1 Sel:2 Session:2][Target:1 Q:4 reserved:3]
    uint8_t params[2];
    params[0] = ((query.dr & 0x01) << 7) | ((query.m & 0x03) << 5) | ((query.trext & 0x01) << 4) |
                ((query.sel & 0x03) << 2) | (query.session & 0x03);
    params[1] = ((query.target & 0x01) << 7) | ((query.q & 0x0F) << 3);
    return sendSimple(kCmdSetQuery, params, sizeof(params));
}

bool YRM100::getQuery(QueryParams& query) {
    if (!sendCommand(kCmdGetQuery, nullptr, 0) || rx_.length < 2) return false;
    const uint8_t high = rx_.params[0];
    const uint8_t low = rx_.params[1];
    query.dr = high >> 7;
    query.m = (high >> 5) & 0x03;
    query.trext = (high >> 4) & 0x01;
    query.sel = (high >> 2) & 0x03;
    query.session = high & 0x03;
    query.target = low >> 7;
    query.q = (low >> 3) & 0x0F;
    return true;
}

// Power management
void YRM100::setBaudRate(uint32_t baud) {
    // The module switches immediately and does not acknowledge.
    uint8_t params[2];
    putU16(params, baud / 100);
    sendFrame(kCmdSetBaudRate, params, sizeof(params));
    serial_.flush();
}

bool YRM100::sleep() {
    return sendSimple(kCmdSleep, nullptr, 0);
}

bool YRM100::setIdleSleepTime(uint8_t minutes) {
    return sendByte(kCmdSetIdleSleep, minutes);
}

// Framing
bool YRM100::sendCommand(uint8_t command, const uint8_t* params, uint16_t length,
                         uint32_t timeoutMs) {
    lastError_ = 0;
    sendFrame(command, params, length);
    return waitForResponse(command, timeoutMs);
}

bool YRM100::sendSimple(uint8_t command, const uint8_t* params, uint16_t length) {
    // "Set" style commands answer with a single 0x00 byte on success.
    return sendCommand(command, params, length) && rx_.length >= 1 && rx_.params[0] == 0x00;
}

bool YRM100::sendByte(uint8_t command, uint8_t value) {
    return sendSimple(command, &value, 1);
}

void YRM100::sendFrame(uint8_t command, const uint8_t* params, uint16_t length) {
    const uint8_t head[] = {kTypeCommand, command, static_cast<uint8_t>(length >> 8),
                            static_cast<uint8_t>(length)};

    uint8_t checksum = 0;
    for (uint8_t b : head) checksum += b;
    for (uint16_t i = 0; i < length; i++) checksum += params[i];

    serial_.write(kFrameHeader);
    serial_.write(head, sizeof(head));
    if (length > 0) serial_.write(params, length);
    serial_.write(checksum);
    serial_.write(kFrameEnd);
}

bool YRM100::waitForResponse(uint8_t command, uint32_t timeoutMs) {
    const uint32_t start = millis();
    while (true) {
        const uint32_t elapsed = millis() - start;
        if (elapsed >= timeoutMs || !readFrame(timeoutMs - elapsed)) return false;

        if (rx_.type != kTypeResponse) continue;  // e.g. tags from a continuous read
        if (rx_.command == command) return true;

        if (rx_.command == kCmdError) {
            // A "no tag" from a still-running continuous read is not our answer.
            if (rx_.params[0] == kErrInventoryNoTag && command != kCmdInventory) continue;
            lastError_ = rx_.params[0];
            return false;
        }
    }
}

bool YRM100::readFrame(uint32_t timeoutMs) {
    const uint32_t start = millis();
    do {
        while (serial_.available()) {
            if (receiveByte(serial_.read())) return true;
        }
        yield();
    } while (millis() - start < timeoutMs);
    return false;
}

bool YRM100::receiveByte(uint8_t byte) {
    switch (rxState_) {
        case RxState::Header:
            if (byte == kFrameHeader) {
                rxChecksum_ = 0;
                rxState_ = RxState::Type;
            }
            return false;

        case RxState::Type:
            rx_.type = byte;
            rxChecksum_ += byte;
            rxState_ = RxState::Command;
            return false;

        case RxState::Command:
            rx_.command = byte;
            rxChecksum_ += byte;
            rxState_ = RxState::LengthHigh;
            return false;

        case RxState::LengthHigh:
            rx_.length = byte << 8;
            rxChecksum_ += byte;
            rxState_ = RxState::LengthLow;
            return false;

        case RxState::LengthLow:
            rx_.length |= byte;
            rxChecksum_ += byte;
            rxIndex_ = 0;
            if (rx_.length > kMaxParamBytes) {
                rxState_ = RxState::Header;  // too big for our buffer, drop it
            } else {
                rxState_ = rx_.length > 0 ? RxState::Params : RxState::Checksum;
            }
            return false;

        case RxState::Params:
            rx_.params[rxIndex_++] = byte;
            rxChecksum_ += byte;
            if (rxIndex_ == rx_.length) rxState_ = RxState::Checksum;
            return false;

        case RxState::Checksum:
            rxState_ = byte == rxChecksum_ ? RxState::End : RxState::Header;
            return false;

        case RxState::End:
            rxState_ = RxState::Header;
            return byte == kFrameEnd;
    }
    return false;
}

// Helpers to encode integers in big-endian order into a byte array.
void YRM100::putU16(uint8_t* out, uint16_t value) {
    out[0] = value >> 8;
    out[1] = value;
}

void YRM100::putU32(uint8_t* out, uint32_t value) {
    out[0] = value >> 24;
    out[1] = value >> 16;
    out[2] = value >> 8;
    out[3] = value;
}

const char* YRM100::statusName(Status status) {
    switch (status) {
        case Status::Ok:              return "ok";
        case Status::Timeout:         return "timeout";
        case Status::NoTag:           return "no tag";
        case Status::WrongPassword:   return "wrong password";
        case Status::TagError:        return "tag error";
        case Status::ModuleError:     return "module error";
        case Status::InvalidArgument: return "invalid argument";
    }
    return "unknown";
}
