# Raspberry Pi Setup Guide

Wi-Fi LED Workshop を Raspberry Pi で試すための手順です。

この資料は、GitHub リポジトリを Public にしてから Raspberry Pi 上で `git clone` する前提で書いています。

Repository:

```text
https://github.com/axuk1k56MH/workshop-led-template
```

## 目的

この教材では、参加者がスマホやPCのブラウザから Raspberry Pi の GPIO LED を操作します。

最終的な本番構成は次の通りです。

```text
スマホ / PC
  ↓ Wi-Fi: LCHIKA-A
Raspberry Pi: 192.168.4.1
  ├ nginx :80
  │   ├ Web UI
  │   └ /api/ → FastAPI :8000
  ├ FastAPI
  └ GPIO LED
```

参加者は班の Wi-Fi に接続し、ブラウザで次を開きます。

```text
http://192.168.4.1
```

## 推奨する確認順

いきなり Raspberry Pi をアクセスポイント化せず、次の順に進めます。

1. Raspberry Pi を既存Wi-Fiに接続する
2. `python app.py` で API と UI を確認する
3. GPIO LED の動作を確認する
4. systemd で自動起動を確認する
5. nginx で `http://<PiのIP>` を確認する
6. 最後に Wi-Fi アクセスポイント化する
7. スマホから `http://192.168.4.1` を確認する

この順番にすると、AP設定でSSH接続を失った場合でも原因を切り分けやすくなります。

## 用意するもの

- Raspberry Pi 4 推奨
- Raspberry Pi OS
- LED 3個
- 330ohm 抵抗 3個
- ジャンパワイヤ
- スマホまたはPC

Raspberry Pi 5 でも試せますが、このテンプレートは現在 `RPi.GPIO` を使っています。Pi 5 でGPIOがうまく動かない場合は、`gpiozero` / `lgpio` 版への切り替えを検討してください。

## GPIO配線

| LED | GPIO |
| --- | --- |
| LED1 | GPIO17 |
| LED2 | GPIO27 |
| LED3 | GPIO22 |

回路:

```text
GPIO ---- 330ohm ---- LED ---- GND
```

## 1. Raspberry Piを既存Wi-Fiに接続

まず Raspberry Pi を普段使っているWi-Fiに接続します。

Pi のIPアドレスを確認します。

```bash
hostname -I
```

MacやPCからSSHする場合:

```bash
ssh <ユーザー名>@<Raspberry PiのIP>
```

例:

```bash
ssh pi@192.168.12.20
```

## 2. 必要パッケージを入れる

Raspberry Pi 上で実行します。

```bash
sudo apt update
sudo apt install -y git python3-venv python3-pip nginx
```

## 3. GitHubからclone

Public リポジトリとして公開済みなら、SSHキー設定なしで HTTPS clone できます。

```bash
cd ~
git clone https://github.com/axuk1k56MH/workshop-led-template.git
cd workshop-led-template
```

リポジトリ名やアカウント名を変更した場合は、URLも読み替えてください。

## 4. 手動起動でテスト

まずは systemd や nginx を使わず、FastAPI を直接起動します。

```bash
cd ~/workshop-led-template/backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python app.py
```

同じWi-Fi上のスマホやPCから開きます。

```text
http://<Raspberry PiのIP>:8000
```

例:

```text
http://192.168.12.20:8000
```

Pi上でAPI確認する場合:

```bash
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:8000/api/leds/state
curl -X POST http://127.0.0.1:8000/api/leds/led1/on
curl -X POST http://127.0.0.1:8000/api/preset/all-off
```

LEDが点灯・消灯すれば、API と GPIO は動作しています。

停止:

```text
Ctrl + C
```

## 5. `/opt` に本番配置

本番用の配置先にコピーします。

```bash
sudo mkdir -p /opt/workshop-led-template
sudo chown -R $USER:$USER /opt/workshop-led-template
cp -a ~/workshop-led-template/. /opt/workshop-led-template/
```

本番配置先で venv を作成します。

```bash
cd /opt/workshop-led-template/backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

## 6. systemdでAPIを自動起動

systemd service を配置します。

```bash
sudo cp /opt/workshop-led-template/systemd/led-workshop-api.service /etc/systemd/system/
```

注意:

`systemd/led-workshop-api.service` は `User=pi` / `Group=pi` を前提にしています。
Raspberry Pi のユーザー名が `pi` ではない場合は、サービスファイルを編集してください。

確認:

```bash
whoami
```

ユーザー名が `teacher` の場合の編集例:

```bash
sudo nano /etc/systemd/system/led-workshop-api.service
```

変更:

```text
User=teacher
Group=teacher
```

有効化して起動します。

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now led-workshop-api
```

状態確認:

```bash
sudo systemctl status led-workshop-api
```

API確認:

```bash
curl http://127.0.0.1:8000/api/health
```

ログ確認:

```bash
journalctl -u led-workshop-api -f
```

## 7. nginxでWeb UIを配信

標準UIを使う場合:

```bash
sudo cp /opt/workshop-led-template/pi-setup/nginx-site-frontend.conf /etc/nginx/sites-available/led-workshop
```

旧UIを使う場合:

```bash
sudo cp /opt/workshop-led-template/pi-setup/nginx-site-legacy.conf /etc/nginx/sites-available/led-workshop
```

nginx に有効化します。

```bash
sudo ln -s /etc/nginx/sites-available/led-workshop /etc/nginx/sites-enabled/led-workshop
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

同じWi-Fi上のスマホやPCから開きます。

```text
http://<Raspberry PiのIP>
```

例:

```text
http://192.168.12.20
```

## 8. Wi-Fiアクセスポイント化

ここから本番の AP 設定です。

注意:

AP化すると、いま使っているWi-Fi接続が切れる可能性があります。できれば次のどれかを用意してください。

- HDMI + キーボード
- 有線LAN
- 予備のSSH接続経路

詳細手順はリポジトリ内の次のファイルにあります。

```text
/opt/workshop-led-template/pi-setup/AP_SETUP.md
```

確認:

```bash
less /opt/workshop-led-template/pi-setup/AP_SETUP.md
```

AP設定の概要:

1. `hostapd` と `dnsmasq` をインストール
2. `wlan0` を `192.168.4.1` に固定
3. `hostapd` で SSID を出す
4. `dnsmasq` で `192.168.4.10` - `192.168.4.60` を配る
5. `nginx` と `led-workshop-api` を自動起動

SSID例:

```text
LCHIKA-A
```

AP化後、スマホから `LCHIKA-A` に接続し、ブラウザで開きます。

```text
http://192.168.4.1
```

## 9. 授業前チェック

Pi上でサービス確認:

```bash
sudo systemctl status led-workshop-api
sudo systemctl status nginx
sudo systemctl status hostapd
sudo systemctl status dnsmasq
```

API確認:

```bash
curl http://192.168.4.1/api/health
curl http://192.168.4.1/api/leds/state
```

LED操作確認:

```bash
curl -X POST http://192.168.4.1/api/leds/led1/on
curl -X POST http://192.168.4.1/api/leds/led1/off
curl -X POST http://192.168.4.1/api/preset/chase \
  -H 'Content-Type: application/json' \
  -d '{"interval_ms":200,"cycles":3}'
curl -X POST http://192.168.4.1/api/preset/all-off
```

スマホから確認:

```text
http://192.168.4.1
```

## トラブルシュート

### `http://<PiのIP>:8000` が開かない

- `python app.py` または `led-workshop-api` が起動しているか確認
- `sudo systemctl status led-workshop-api`
- `curl http://127.0.0.1:8000/api/health`

### nginxの画面は出るがLED操作できない

- `/api/` proxy が動いていない可能性があります
- `sudo nginx -t`
- `curl http://127.0.0.1:8000/api/health`
- `curl http://<PiのIP>/api/health`

### LEDが点かない

- GPIO番号と物理ピン番号を取り違えていないか確認
- LEDの向きを確認
- 抵抗が入っているか確認
- `journalctl -u led-workshop-api -f` でGPIOログを確認

### AP化後にSSHできない

- スマホ/PCが `LCHIKA-A` に接続できているか確認
- PiのAP側IPは `192.168.4.1`
- ブラウザで `http://192.168.4.1`
- 可能ならHDMI + キーボードで直接確認

## 授業当日の最短手順

準備済みのPiなら、当日は次だけ確認します。

```bash
sudo systemctl status led-workshop-api
sudo systemctl status nginx
sudo systemctl status hostapd
sudo systemctl status dnsmasq
curl http://192.168.4.1/api/health
```

スマホで:

```text
Wi-Fi: LCHIKA-A
URL: http://192.168.4.1
```
