#include <Arduino.h>
#include <unity.h>

#include "RfidDoor.h"

static const uint8_t SS_PIN = D8;
static const uint8_t RST_PIN = D2;
static const uint8_t SERVO_PIN = D3;

RfidDoor door(SS_PIN, RST_PIN, SERVO_PIN);

void test_card_triggers_door() {
    Serial.println("Scan a card within 15 seconds...");

    bool triggered = false;
    unsigned long start = millis();

    while (millis() - start < 15000) {
        if (door.update()) {
            triggered = true;
            break;
        }
    }

    TEST_ASSERT_TRUE(triggered);
}

void setup() {
    Serial.begin(115200);
    delay(2000);

    door.begin();

    UNITY_BEGIN();
    RUN_TEST(test_card_triggers_door);
    UNITY_END();
}

void loop() {}
