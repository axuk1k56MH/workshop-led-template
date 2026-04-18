# Raspberry Pi AP Setup

この手順は Raspberry Pi を Wi-Fi 親機にして、参加者が `http://192.168.4.1` から LED 操作画面へアクセスできるようにします。

## 前提

- Raspberry Pi OS
- 有線 LAN または別経路でインターネット接続できる状態
- このリポジトリを `/opt/workshop-led-template` に配置
- 班ごとに SSID を `LCHIKA-A`、`LCHIKA-B`、`LCHIKA-C`、`LCHIKA-D` のいずれかへ変更
- `sudo raspi-config` で WLAN Country を設定済み

この手順は DHCP 範囲を明示できるように、`hostapd + dnsmasq` を使います。Raspberry Pi OS Bookworm 以降は NetworkManager が標準のため、`wlan0` だけ NetworkManager の管理から外して使います。

## パッケージ

```bash
sudo apt update
sudo apt install -y hostapd dnsmasq nginx python3-venv python3-pip
sudo systemctl unmask hostapd
sudo systemctl disable --now hostapd dnsmasq
```

## wlan0 を NetworkManager から外す

NetworkManager が有効な Raspberry Pi OS では、`wlan0` を unmanaged にします。

```conf
[keyfile]
unmanaged-devices=interface-name:wlan0
```

保存先:

```text
/etc/NetworkManager/conf.d/99-unmanaged-wlan0.conf
```

反映します。

```bash
sudo systemctl reload NetworkManager
```

NetworkManager を使っていない古い Raspberry Pi OS では、この章は不要です。

## 固定 IP

Bookworm 以降では `systemd-networkd` で `wlan0` に固定 IP を設定します。

```conf
[Match]
Name=wlan0

[Network]
Address=192.168.4.1/24
LinkLocalAddressing=no
ConfigureWithoutCarrier=yes
```

保存先:

```text
/etc/systemd/network/20-wlan0.network
```

反映します。

```bash
sudo systemctl enable --now systemd-networkd
sudo networkctl reload
```

`/etc/dhcpcd.conf` を使う古い Raspberry Pi OS では、代わりに末尾へ次を追加します。

```conf
interface wlan0
static ip_address=192.168.4.1/24
nohook wpa_supplicant
```

## hostapd

`/etc/hostapd/hostapd.conf` を作成します。`ssid` は班に合わせて変更してください。

```conf
interface=wlan0
driver=nl80211
ssid=LCHIKA-A
hw_mode=g
channel=6
wmm_enabled=0
auth_algs=1
ignore_broadcast_ssid=0
```

`/etc/default/hostapd` に設定ファイルを指定します。

```conf
DAEMON_CONF="/etc/hostapd/hostapd.conf"
```

## dnsmasq

`/etc/dnsmasq.conf` を退避してから、新規作成します。

```bash
sudo mv /etc/dnsmasq.conf /etc/dnsmasq.conf.orig
```

```conf
interface=wlan0
dhcp-range=192.168.4.10,192.168.4.60,255.255.255.0,24h
domain-needed
bogus-priv
```

## Python API

```bash
cd /opt/workshop-led-template/backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

PC や GPIO なし環境でテストする場合は次のように起動します。

```bash
USE_MOCK_GPIO=1 python app.py
```

## systemd

```bash
sudo cp /opt/workshop-led-template/systemd/led-workshop-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now led-workshop-api
```

## nginx

```bash
sudo cp /opt/workshop-led-template/pi-setup/nginx-site.conf /etc/nginx/sites-available/led-workshop
sudo ln -s /etc/nginx/sites-available/led-workshop /etc/nginx/sites-enabled/led-workshop
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 起動

```bash
sudo systemctl enable --now hostapd dnsmasq nginx led-workshop-api
sudo reboot
```

再起動後、参加者端末から班の SSID へ接続し、ブラウザで次へアクセスします。

```text
http://192.168.4.1
```

## 動作確認

```bash
curl http://192.168.4.1/api/health
curl http://192.168.4.1/api/leds/state
curl -X POST http://192.168.4.1/api/leds/led1/on
curl -X POST http://192.168.4.1/api/preset/all-off
```
