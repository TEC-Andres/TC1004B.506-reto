#include <Arduino.h>

#include "RfidDoor.h"

static const uint8_t SS_PIN = D8;
static const uint8_t RST_PIN = D2;
static const uint8_t SERVO_PIN = D3;

RfidDoor door(SS_PIN, RST_PIN, SERVO_PIN);

void setup() {
    Serial.begin(115200);
    delay(2000);

    door.begin();
    door.addCard(0xED, 0x5A, 0x19, 0x06, "Tarjeta A");
    door.addCard(0xAB, 0x3C, 0x5B, 0x06, "Tarjeta B");
    door.addCard(0x0A, 0x2D, 0xF9, 0x05, "Tarjeta C");

    Serial.println("Scan a card within 15 seconds...");

    bool triggered = false;
    unsigned long start = millis();

    while (millis() - start < 15000) {
        if (door.update()) {
            triggered = true;
            break;
        }
    }

    Serial.println(triggered ? "PASS" : "FAIL");
}

void loop() {}
