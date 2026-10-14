#include "RfidDoor.h"

#include <SPI.h>

RfidDoor::RfidDoor(uint8_t ssPin, uint8_t rstPin, uint8_t servoPin)
    : _reader(ssPin, rstPin), _servoPin(servoPin), _cardCount(0) {}

void RfidDoor::addCard(byte uid0, byte uid1, byte uid2, byte uid3, const char* label) {
    if (_cardCount >= MAX_CARDS) {
        return;
    }

    _cards[_cardCount].uid[0] = uid0;
    _cards[_cardCount].uid[1] = uid1;
    _cards[_cardCount].uid[2] = uid2;
    _cards[_cardCount].uid[3] = uid3;
    _cards[_cardCount].label = label;
    _cardCount++;
}

const char* RfidDoor::identify(byte* uid) {
    for (uint8_t i = 0; i < _cardCount; i++) {
        if (memcmp(uid, _cards[i].uid, 4) == 0) {
            return _cards[i].label;
        }
    }

    return "Desconocida";
}

void RfidDoor::begin() {
    SPI.begin();
    _reader.PCD_Init();
    _servo.attach(_servoPin);
    _servo.write(0);

    Serial.println("+------------+----------------------+----------------------+");
    Serial.printf("| %-10s | %-20s | %-20s |\n", "Detecto", "UID", "Accion");
    Serial.println("+------------+----------------------+----------------------+");
}

bool RfidDoor::update() {
    if (!_reader.PICC_IsNewCardPresent() || !_reader.PICC_ReadCardSerial()) {
        Serial.printf("| %-10s | %-20s | %-20s |\n", "NO", "-", "Esperando tarjeta");
        delay(500);
        return false;
    }

    String uid = "";
    for (byte i = 0; i < _reader.uid.size; i++) {
        if (i > 0) {
            uid += " ";
        }
        if (_reader.uid.uidByte[i] < 0x10) {
            uid += "0";
        }
        uid += String(_reader.uid.uidByte[i], HEX);
    }
    uid.toUpperCase();

    const char* label = identify(_reader.uid.uidByte);
    String action = String(label) + " - Abriendo puerta";

    Serial.printf("| %-10s | %-20s | %-20s |\n", "SI", uid.c_str(), action.c_str());

    _servo.write(180);
    delay(3000);
    _servo.write(0);

    _reader.PICC_HaltA();
    _reader.PCD_StopCrypto1();

    return true;
}
