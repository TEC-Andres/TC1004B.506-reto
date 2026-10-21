/*
#   YRM100 UHF RFID reader driver
#
#   Rewritten from the vendor "YRM100 SDK 202604" (C# READER_LIB_PRO_V2.1,
#   Arduino samples and command table) as a single readable class.
#
#   Wire protocol (all multi-byte fields are big-endian):
#
#     BB | type | command | lenHigh lenLow | params... | checksum | 7E
#
#     type      0x00 command (host -> module)
#               0x01 response (module -> host)
#               0x02 notification (module -> host, e.g. a tag seen)
#     checksum  low byte of the sum of type..last param
#
#   The module talks 115200 8N1 by default. Wire its TXD to the MCU RX pin,
#   its RXD to the MCU TX pin, and tie EN high to enable the module.
*/
#pragma once

#include <Arduino.h>
#include <Stream.h>

class YRM100 {
public:
    static constexpr size_t kMaxEpcBytes = 32;
    static constexpr size_t kMaxParamBytes = 256;
    static constexpr uint32_t kDefaultTimeoutMs = 500;

    enum class Region : uint8_t {
        China900 = 0x01,  // 920.125 - 924.875 MHz
        US       = 0x02,  // 902.25  - 927.75  MHz
        Europe   = 0x03,  // 865.1   - 867.9   MHz
        China800 = 0x04,  // 840.125 - 844.875 MHz
        Korea    = 0x06,  // 917.1   - 923.3   MHz
    };

    enum class MemoryBank : uint8_t {
        Reserved = 0x00,  // kill password (words 0-1) + access password (words 2-3)
        EPC      = 0x01,  // CRC (word 0), PC (word 1), EPC (word 2...)
        TID      = 0x02,
        User     = 0x03,
    };

    // Which part of the tag a lock() call applies to.
    enum class LockArea : uint8_t {
        KillPassword   = 0,
        AccessPassword = 1,
        EPC            = 2,
        TID            = 3,
        User           = 4,
    };

    enum class LockAction : uint8_t {
        Unlock          = 0,
        Lock            = 1,  // writable only after the access password is given
        PermanentUnlock = 2,
        PermanentLock   = 3,
    };

    // When the module sends the Select filter configured by setSelect().
    enum class SelectMode : uint8_t {
        Always     = 0x00,  // before every inventory and tag access
        Never      = 0x01,
        AccessOnly = 0x02,  // only before read / write / lock / kill
    };

    enum class Status : uint8_t {
        Ok,
        Timeout,          // no reply from the module
        NoTag,            // no tag answered in the RF field
        WrongPassword,
        TagError,         // tag answered with an EPC Gen2 error code
        ModuleError,      // module rejected the command; see lastErrorCode()
        InvalidArgument,
    };

    // Raw error codes the module sends in a 0xFF response.
    enum ErrorCode : uint8_t {
        kErrInvalidParam    = 0x0E,
        kErrReadNoTag       = 0x09,
        kErrWriteNoTag      = 0x10,
        kErrKillNoTag       = 0x12,
        kErrLockNoTag       = 0x13,
        kErrInventoryNoTag  = 0x15,
        kErrAccessPassword  = 0x16,
        kErrInvalidCommand  = 0x17,
        kErrFrequencyHop    = 0x20,
        kErrReadTagBase     = 0xA0,  // low nibble holds the Gen2 tag error code
        kErrWriteTagBase    = 0xB0,
        kErrLockTagBase     = 0xC0,
        kErrKillTagBase     = 0xD0,
    };

    struct Tag {
        int8_t rssi = 0;  // dBm
        uint16_t pc = 0;  // protocol control word
        uint8_t epc[kMaxEpcBytes] = {};
        uint8_t epcLength = 0;  // bytes
        uint16_t crc = 0;

        String epcHex() const;
        bool epcEquals(const uint8_t* other, size_t length) const;
    };

    // Gen2 Query parameters (see setQuery()).
    struct QueryParams {
        uint8_t dr = 0;       // divide ratio: 0 = 8, 1 = 64/3
        uint8_t m = 0;        // miller: 0 = FM0, 1 = M2, 2 = M4, 3 = M8
        uint8_t trext = 1;    // pilot tone
        uint8_t sel = 0;      // 0/1 = all, 2 = ~SL, 3 = SL
        uint8_t session = 0;  // S0..S3
        uint8_t target = 0;   // 0 = A, 1 = B
        uint8_t q = 4;        // 0..15, expect up to 2^q tags
    };

    struct Frame {
        uint8_t type = 0;
        uint8_t command = 0;
        uint16_t length = 0;
        uint8_t params[kMaxParamBytes] = {};
    };

    explicit YRM100(Stream& serial);

    // Returns true when the module answers a hardware version request.
    bool begin();

    // ---- Module information -------------------------------------------
    String hardwareVersion();
    String softwareVersion();
    String manufacturer();

    // ---- Inventory ----------------------------------------------------
    // One inventory round. Fills up to maxTags and returns how many were seen.
    size_t readSingle(Tag* tags, size_t maxTags, uint32_t timeoutMs = kDefaultTimeoutMs);

    // Continuous inventory; collect tags with poll(). 0xFFFF rounds ~ forever.
    void startContinuousRead(uint16_t rounds = 0xFFFF);
    bool stopContinuousRead();

    // Non-blocking. Returns true when a tag notification has been received.
    bool poll(Tag& tag);

    // ---- Tag memory ---------------------------------------------------
    // Addresses and counts are in 16-bit words. `data` must hold wordCount*2 bytes.
    Status readMemory(MemoryBank bank, uint16_t wordAddress, uint16_t wordCount,
                      uint8_t* data, uint32_t accessPassword = 0);
    Status writeMemory(MemoryBank bank, uint16_t wordAddress, uint16_t wordCount,
                       const uint8_t* data, uint32_t accessPassword = 0);

    // Writes a new EPC (even byte length) and updates the PC word to match.
    Status writeEpc(const uint8_t* epc, size_t length, uint32_t accessPassword = 0);

    Status lock(LockArea area, LockAction action, uint32_t accessPassword = 0);
    Status kill(uint32_t killPassword);

    // ---- Tag selection ------------------------------------------------
    // Gen2 Select filter. pointerBits/maskBits are in bits.
    bool setSelect(MemoryBank bank, uint32_t pointerBits, const uint8_t* mask, uint8_t maskBits,
                   uint8_t target = 0, uint8_t action = 0, bool truncate = false);
    bool setSelectMode(SelectMode mode);

    // Restrict read / write / lock / kill to the tag with this EPC.
    bool selectEpc(const uint8_t* epc, size_t length);

    // ---- RF configuration ---------------------------------------------
    bool setRegion(Region region);
    bool getRegion(Region& region);

    bool setChannel(uint8_t index);
    bool getChannel(uint8_t& index);
    bool setFrequencyHopping(bool enabled);

    bool setTransmitPower(float dBm);
    bool getTransmitPower(float& dBm);

    bool setQuery(const QueryParams& query);
    bool getQuery(QueryParams& query);

    // ---- Power / link -------------------------------------------------
    // After this the host serial port must be re-opened at the new speed.
    void setBaudRate(uint32_t baud);
    bool sleep();
    bool setIdleSleepTime(uint8_t minutes);  // 0 disables auto sleep

    // ---- Low level ----------------------------------------------------
    // Sends any command and waits for its response. On success the reply is
    // in lastResponse(); on failure lastErrorCode() holds the module's error
    // code (0 means the module did not answer).
    bool sendCommand(uint8_t command, const uint8_t* params, uint16_t length,
                     uint32_t timeoutMs = kDefaultTimeoutMs);

    const Frame& lastResponse() const { return rx_; }
    uint8_t lastErrorCode() const { return lastError_; }
    static const char* statusName(Status status);

private:
    enum Command : uint8_t {
        kCmdModuleInfo      = 0x03,
        kCmdSetRegion       = 0x07,
        kCmdGetRegion       = 0x08,
        kCmdSetSelect       = 0x0C,
        kCmdGetQuery        = 0x0D,
        kCmdSetQuery        = 0x0E,
        kCmdSetBaudRate     = 0x11,
        kCmdSetSelectMode   = 0x12,
        kCmdSleep           = 0x17,
        kCmdSetIdleSleep    = 0x1D,
        kCmdInventory       = 0x22,
        kCmdMultiInventory  = 0x27,
        kCmdStopInventory   = 0x28,
        kCmdReadData        = 0x39,
        kCmdWriteData       = 0x49,
        kCmdKill            = 0x65,
        kCmdLock            = 0x82,
        kCmdGetChannel      = 0xAA,
        kCmdSetChannel      = 0xAB,
        kCmdSetHopping      = 0xAD,
        kCmdSetPower        = 0xB6,
        kCmdGetPower        = 0xB7,
        kCmdError           = 0xFF,
    };

    enum FrameType : uint8_t {
        kTypeCommand      = 0x00,
        kTypeResponse     = 0x01,
        kTypeNotification = 0x02,
    };

    enum class RxState : uint8_t { Header, Type, Command, LengthHigh, LengthLow, Params, Checksum, End };

    static constexpr uint8_t kFrameHeader = 0xBB;
    static constexpr uint8_t kFrameEnd = 0x7E;
    static constexpr uint32_t kTagGapMs = 50;  // readSingle stops after this much silence

    void sendFrame(uint8_t command, const uint8_t* params, uint16_t length);
    bool receiveByte(uint8_t byte);  // true when rx_ holds a complete, valid frame
    bool readFrame(uint32_t timeoutMs);
    bool waitForResponse(uint8_t command, uint32_t timeoutMs);

    bool sendSimple(uint8_t command, const uint8_t* params, uint16_t length);
    bool sendByte(uint8_t command, uint8_t value);
    String readModuleInfo(uint8_t field);
    Status accessTag(uint8_t command, const uint8_t* params, uint16_t length);
    Status statusFromError(uint8_t code) const;

    static bool parseTag(const Frame& frame, Tag& tag);
    static void putU16(uint8_t* out, uint16_t value);
    static void putU32(uint8_t* out, uint32_t value);

    Stream& serial_;
    Frame rx_;
    RxState rxState_ = RxState::Header;
    uint16_t rxIndex_ = 0;
    uint8_t rxChecksum_ = 0;
    uint8_t lastError_ = 0;
};
