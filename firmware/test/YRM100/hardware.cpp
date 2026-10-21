// Prueba 2: lee el tag directo del YRM100 conectado al NodeMCU
// YRM100 TXD -> RX, RXD -> TX, EN -> 3V3. Desconecta RX al subir el código.
#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

#include "YRM100.h"

LiquidCrystal_I2C lcd(0x27, 16, 2);
YRM100 yrm(Serial);

constexpr uint8_t PINSDA = D2;
constexpr uint8_t PINSCL = D1;

void setup() {
    Serial.begin(115200);
    Wire.begin(PINSDA, PINSCL);
    lcd.init();
    lcd.backlight();
    lcd.print(yrm.begin() ? "YRM100 listo" : "YRM100 no responde");

    yrm.startContinuousRead();
}

void loop() {
    YRM100::Tag tag;
    if(yrm.poll(tag)) {
        String epc = tag.epcHex();
        lcd.clear();
        lcd.print(epc.substring(max(0, (int)epc.length() - 16)));
        lcd.setCursor(0, 1);
        lcd.print("RSSI: ");
        lcd.print(tag.rssi);
    }
}
