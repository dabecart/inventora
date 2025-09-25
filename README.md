# Inventora

## Setup

Requisites:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
nvm install 22.19.0
```

To run it:

```bash
npm run dev
```

To create the project from the ground up:

```bash
npm create vite@latest inventora -- --template react
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
```

How to connect a phone to the app (from WSL2):
```bash
npm run dev -- --host

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://10.255.255.254:5173/
  ➜  Network: http://172.27.41.80:5173/
```

Get the IP that is shared between Windows and WSL2 (in my case, 172.27.41.80). This direction can be opened from the computer. 
Connect the port 5173 of WSL2 to the port 5173 of Windows (run terminal as admin):
```
netsh interface portproxy set v4tov4 listenport=5173 listenaddress=0.0.0.0 connectport=5173 connectaddress=172.27.41.80
```