# Wi-Fi LED Workshop

ブラウザから Raspberry Pi の GPIO LED を操作する、教育用 IoT 体験テンプレートです。

## 構成

```text
workshop-led-template
├── backend
│   ├── app.py
│   └── requirements.txt
├── backend-ui
│   ├── index.html
│   ├── script.js
│   └── style.css
├── frontend
│   ├── index.html
│   ├── script.js
│   └── style.css
├── pi-setup
│   ├── AP_SETUP.md
│   ├── nginx-site.conf
│   ├── nginx-site-frontend.conf
│   └── nginx-site-legacy.conf
└── systemd
    └── led-workshop-api.service
```

## API

- `GET /api/health`
- `GET /api/leds/state`
- `POST /api/leds/{led_id}/on`
- `POST /api/leds/{led_id}/off`
- `POST /api/leds/{led_id}/blink`
- `POST /api/preset/all-off`
- `POST /api/preset/chase`

`led_id` は `led1`、`led2`、`led3` です。

## PC テスト

バックエンドとフロントエンドをまとめて試す場合:

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
USE_MOCK_GPIO=1 python app.py
```

ブラウザで次を開きます。

```text
http://127.0.0.1:8000
```

`8000` は FastAPI が配信する前UIです。

フロントエンドだけ別ポートで配信して、バックエンドAPIへ接続する場合:

```bash
cd frontend
python3 -m http.server 5500
```

ブラウザで次を開きます。

```text
http://127.0.0.1:5500/?api=http://127.0.0.1:8000
```

`5500` は `frontend` ディレクトリの新UIです。APIだけ `8000` のバックエンドへ向けます。

## Raspberry Pi 本番配置

1. リポジトリを `/opt/workshop-led-template` に配置
2. `backend` に venv を作成して `pip install -r requirements.txt`
3. `systemd/led-workshop-api.service` を `/etc/systemd/system/` へ配置
4. 新UIなら `pi-setup/nginx-site-frontend.conf`、前UIなら `pi-setup/nginx-site-legacy.conf` を nginx に配置
5. `pi-setup/AP_SETUP.md` に沿って Wi-Fi AP を設定

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
