# Wi-Fi LED Workshop Specification

## System Name

Wi-Fi内Web操作型 LED 制御システム（教育用）

副題: ブラウザから物理デバイスを操作する IoT 体験

## Purpose

本システムは、次の学習体験を提供する。

- Wi-Fiネットワークの理解
- Webアプリと物理デバイスの接続
- 非同期処理の概念
- 複数ユーザー同時操作
- IoTシステムの基本構造

## Intended Class Environment

- 参加者: 12名
- 班構成: 3人 × 4班
- Raspberry Pi: 1班につき1台、合計4台

## Hardware

- Raspberry Pi 4 または Raspberry Pi 5
- LED × 3
- 抵抗 330ohm × 3

GPIO割り当て:

| LED | GPIO |
| --- | --- |
| LED1 | GPIO17 |
| LED2 | GPIO27 |
| LED3 | GPIO22 |

回路:

```text
GPIO ---- 330ohm ---- LED ---- GND
```

## Network

Raspberry Pi は Wi-Fi アクセスポイントとして動作する。

| Item | Value |
| --- | --- |
| Pi IP | `192.168.4.1` |
| URL | `http://192.168.4.1` |
| DHCP range | `192.168.4.10` - `192.168.4.60` |

班ごとのSSID:

- `LCHIKA-A`
- `LCHIKA-B`
- `LCHIKA-C`
- `LCHIKA-D`

## Production Architecture

```text
スマホ / PC
  ↓ Wi-Fi
Raspberry Pi
  ├ Wi-Fi AP
  ├ nginx :80
  │   ├ Web UI
  │   └ /api/ → FastAPI :8010
  ├ FastAPI
  └ GPIO LED
```

## Software

- OS: Raspberry Pi OS
- Web server: nginx
- API: FastAPI
- UI: HTML / CSS / JavaScript
- GPIO: RPi.GPIO
- Local test GPIO: mock GPIO via `USE_MOCK_GPIO=1`

## UI Policy

ブラウザ操作を学習体験に含めるため、Web UI は必要である。

ただし、UIは学習目的に対する入口であり、システムの中核は次の3点である。

- ブラウザからHTTP APIを呼ぶ
- FastAPIがGPIO制御へ変換する
- 物理LEDが変化する

本番推奨UI:

- `frontend`
- 標準UI
- nginxでは `nginx-site-frontend.conf` で配信

任意UI:

- `examples/legacy-ui`
- 以前のスマホ向けUIの保存版
- デモや比較用
- nginxでは `nginx-site-legacy.conf` で配信

GitHubでの導入性を優先する場合、READMEでは `frontend` を標準UIとして扱う。

## API

### Health

```http
GET /api/health
```

Response:

```json
{
  "ok": true
}
```

### LED State

```http
GET /api/leds/state
```

Response:

```json
{
  "led1": "on",
  "led2": "off",
  "led3": "blinking"
}
```

### LED On

```http
POST /api/leds/{led_id}/on
```

Example:

```http
POST /api/leds/led1/on
```

### LED Off

```http
POST /api/leds/{led_id}/off
```

### LED Blink

```http
POST /api/leds/{led_id}/blink
```

Body:

```json
{
  "interval_ms": 500
}
```

### All Off

```http
POST /api/preset/all-off
```

### Chase

```http
POST /api/preset/chase
```

Body:

```json
{
  "interval_ms": 200,
  "cycles": 5
}
```

## Concurrency

- 3人程度の同時操作を想定
- 最後に押した操作が有効
- 点滅中に新しい操作が来た場合、既存の点滅タスクを停止して新しい操作を反映する

## Safety

- 起動時は全LED OFF
- 終了時は全LED OFF
- 終了時に GPIO cleanup
- 異常時も可能な限りLED OFFへ戻す

## Local Test

GPIOがない環境では mock GPIO を使う。

```bash
USE_MOCK_GPIO=1 python app.py
```

mock GPIO は実LEDを操作せず、ログへGPIO出力を表示する。

## 90-Minute Class Flow

| Time | Content |
| --- | --- |
| 0-10 min | Wi-Fiとは |
| 10-20 min | スマホ/PC接続 |
| 20-40 min | LED操作 |
| 40-70 min | 改造、例: 点滅速度変更 |
| 70-90 min | 応用、例: 信号機 |

## Planned Extensions

- RGB LED
- 色制御
- 温度/距離/加速度などのセンサー
- 自動OFFタイマー
- 操作履歴ログ
- 班表示: Team A / B / C / D
- Web → センサー → 可視化
