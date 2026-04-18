# Wi-Fi LED Workshop

Raspberry Pi を Wi-Fi 親機にして、参加者がスマホやPCのブラウザから GPIO LED を操作する教育用 IoT ワークショップテンプレートです。

## What This Provides

- Raspberry Pi 上の FastAPI による LED 操作API
- PC/Macテスト用のモックGPIO
- スマホ向けWeb UI
- Raspberry Pi を Wi-Fi アクセスポイントにするための設定手順
- nginx と systemd の本番配置ファイル

## Recommended Setup

本番授業では、次の構成を推奨します。

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

参加者は班のSSIDへ接続し、ブラウザで次を開きます。

```text
http://192.168.4.1
```

## Directory Layout

```text
workshop-led-template
├── backend
│   ├── app.py
│   └── requirements.txt
├── frontend
│   ├── index.html
│   ├── script.js
│   └── style.css
├── examples
│   └── legacy-ui
│       ├── index.html
│       ├── script.js
│       └── style.css
├── pi-setup
│   ├── AP_SETUP.md
│   ├── nginx-site.conf
│   ├── nginx-site-frontend.conf
│   └── nginx-site-legacy.conf
└── systemd
    └── led-workshop-api.service
```

`frontend` が本番推奨の標準UIです。`examples/legacy-ui` は以前のスマホ向けUIを残した比較・退避用です。

## Quick Start On Mac / PC

```bash
git clone <repository-url>
cd workshop-led-template/backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
USE_MOCK_GPIO=1 python app.py
```

ブラウザで開きます。

```text
http://127.0.0.1:8000
```

この `8000` では FastAPI が `frontend` の標準UIを配信します。API確認用として手早く使えます。

## Test The Legacy UI

旧UIを確認する場合は、バックエンドを起動したまま別ターミナルで実行します。

```bash
cd workshop-led-template/examples/legacy-ui
python3 -m http.server 5500 --bind 0.0.0.0
```

Mac/PCのブラウザ:

```text
http://127.0.0.1:5500/?api=http://127.0.0.1:8000
```

同じWi-Fi上のスマホ:

```text
http://<MacのIP>:5500/?api=http://<MacのIP>:8000
```

例:

```text
http://192.168.12.4:5500/?api=http://192.168.12.4:8000
```

## Raspberry Pi Deployment

1. このリポジトリを Raspberry Pi の `/opt/workshop-led-template` に配置
2. `backend` に Python venv を作成して依存関係をインストール
3. `systemd/led-workshop-api.service` を systemd に登録
4. nginx 設定を配置
5. `pi-setup/AP_SETUP.md` に沿って Wi-Fi AP を設定

標準UIを本番配信する場合:

```bash
sudo cp /opt/workshop-led-template/pi-setup/nginx-site-frontend.conf /etc/nginx/sites-available/led-workshop
```

旧UIを本番配信する場合:

```bash
sudo cp /opt/workshop-led-template/pi-setup/nginx-site-legacy.conf /etc/nginx/sites-available/led-workshop
```

詳細は [pi-setup/AP_SETUP.md](pi-setup/AP_SETUP.md) を参照してください。

## API

- `GET /api/health`
- `GET /api/leds/state`
- `POST /api/leds/{led_id}/on`
- `POST /api/leds/{led_id}/off`
- `POST /api/leds/{led_id}/blink`
- `POST /api/preset/all-off`
- `POST /api/preset/chase`

`led_id` は `led1`、`led2`、`led3` です。

## GPIO

| LED | GPIO |
| --- | --- |
| LED1 | GPIO17 |
| LED2 | GPIO27 |
| LED3 | GPIO22 |

回路:

```text
GPIO ---- 330ohm ---- LED ---- GND
```

## Specification

設計仕様は [SPEC.md](SPEC.md) にまとめています。

## Publish To GitHub

GitHubで空のリポジトリを作成したあと、ローカルからリモートを追加してpushします。

```bash
git remote add origin git@github.com:<your-account>/<repository-name>.git
git push -u origin main
```

HTTPS URLを使う場合:

```bash
git remote add origin https://github.com/<your-account>/<repository-name>.git
git push -u origin main
```

すでに `origin` を追加済みの場合は、URLだけ確認してpushします。

```bash
git remote -v
git push -u origin main
```

## License

MIT License. See [LICENSE](LICENSE).
