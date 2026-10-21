#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecureBearSSL.h>

#include "secrets.h"

constexpr uint8_t PINSDA = D2;
constexpr uint8_t PINSCL = D1;
constexpr uint32_t POLL_MS = 500;

// Servidor: python yrm100.py --port COMx serve
const char *TAG_URL = "https://anchovy-glory-undying.ngrok-free.dev/latest";

LiquidCrystal_I2C lcd(0x27, 16, 2);
BearSSL::WiFiClientSecure client;
HTTPClient http;
String shown;

void lcdShow(const String &line0, const String &line1) {
    String text = line0 + "\n" + line1;
    if(text == shown) return;   // evita parpadeo si no cambió nada
    shown = text;
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(line0.substring(0, 16));
    lcd.setCursor(0, 1);
    lcd.print(line1.substring(0, 16));
}

void connectWiFi() {
    lcdShow("Conectando WiFi", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    while(WiFi.status() != WL_CONNECTED) delay(250);
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    lcdShow("WiFi conectado", WiFi.localIP().toString());
}

void setup() {
    Serial.begin(115200);
    Wire.begin(PINSDA, PINSCL);

    lcd.init();
    lcd.backlight();

    connectWiFi();
    client.setInsecure();   // ngrok usa un certificado válido, pero no guardamos la CA en el ESP
    http.setReuse(true);
    http.setTimeout(15000);   // el handshake TLS (ECDHE + ECDSA) tarda varios segundos en el ESP8266
}

void loop() {
    if(WiFi.status() != WL_CONNECTED) connectWiFi();

    if(!http.begin(client, TAG_URL)) {
        lcdShow("Error HTTP", "begin()");
        delay(POLL_MS);
        return;
    }
    http.addHeader("ngrok-skip-browser-warning", "1");
    int code = http.GET();
    if(code == HTTP_CODE_OK) {
        // Respuesta: "<epc> <rssi> <tags>" o "- 0 0" si no hay tag
        String body = http.getString();
        body.trim();
        int a = body.indexOf(' ');
        int b = body.indexOf(' ', a + 1);
        String epc = body.substring(0, a);
        String rssi = body.substring(a + 1, b);
        String count = body.substring(b + 1);
        Serial.println(body);
        if(a < 0 || b < 0) lcdShow("Respuesta mala", body);
        else if(epc == "-") lcdShow("Sin tag", "Esperando...");
        else lcdShow(epc.substring(max(0, (int)epc.length() - 16)),   // últimos 16 hex del EPC
                     "RSSI:" + rssi + " Tags:" + count);
    } else {
        char sslError[64] = "";
        int sslCode = client.getLastSSLError(sslError, sizeof(sslError));
        Serial.printf("HTTP %d (%s) SSL %d: %s, heap %u\n", code, http.errorToString(code).c_str(),
                      sslCode, sslError, ESP.getFreeHeap());
        lcdShow("Servidor caido", "HTTP " + String(code));
    }
    http.end();
    delay(POLL_MS);
}
