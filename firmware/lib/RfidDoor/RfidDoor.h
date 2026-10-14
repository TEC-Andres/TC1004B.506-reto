#pragma once

#include <Arduino.h>
#include <MFRC522.h>
#include <Servo.h>

struct RfidCard {
    byte uid[4];
    const char* label;
};

class RfidDoor {
public:
    RfidDoor(uint8_t ssPin, uint8_t rstPin, uint8_t servoPin);

    void begin();
    void addCard(byte uid0, byte uid1, byte uid2, byte uid3, const char* label);
    bool update();

private:
    static const uint8_t MAX_CARDS = 8;

    MFRC522 _reader;
    Servo _servo;
    uint8_t _servoPin;
    RfidCard _cards[MAX_CARDS];
    uint8_t _cardCount;

    const char* identify(byte* uid);
};
