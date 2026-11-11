// YRM100 TXD -> D6 (RX), RXD -> D5 (TX), EN -> 3V3, GND común.
// El YRM100 usa SoftwareSerial; Serial (USB, 74880) queda libre para depuración.
#include <Arduino.h>
#include <SoftwareSerial.h>

#include "YRM100.h"

constexpr uint32_t YRM_BAUD  = 74880;
constexpr uint32_t NODE_BAUD = 115200;

// YRM 
constexpr uint8_t PINRX = D6; // TX
constexpr uint8_t PINTX = D5; // RX

SoftwareSerial yrmSerial(PINRX, PINTX);
YRM100 yrm(yrmSerial);

void setup() {
    Serial.begin(YRM_BAUD); // igual que el log de arranque del ESP8266
    yrmSerial.begin(NODE_BAUD);

    Serial.println(yrm.begin() ? "YRM100 listo" : "YRM100 no responde");

    yrm.startContinuousRead();
}

void loop() {
    YRM100::Tag tag;
    if(yrm.poll(tag)) {
        Serial.print("EPC: ");
        Serial.print(tag.epcHex());
        Serial.print(" RSSI: ");
        Serial.println(tag.rssi);
    }
}
