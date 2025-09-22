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