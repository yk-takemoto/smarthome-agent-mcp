# ベースイメージの指定
FROM node:18-alpine

# 作業ディレクトリの設定
WORKDIR /app

# 自己署名証明書が必要な場合は、certs/ca.pemに配置のうえ以下の行を有効化
# COPY certs/ca.pem ./
# ENV NODE_EXTRA_CA_CERTS=/app/ca.pem

# システム定義ファイルをコピー
COPY *.json ./
COPY *.mjs ./

# 依存関係のインストール
RUN npm install

# アプリケーションのソースコード、コンテンツをコピー
WORKDIR /app/src
COPY ./src .
WORKDIR /app/public
COPY ./public .
WORKDIR /app/audio
COPY ./audio .

# アプリケーションの定義ファイルをコピー
WORKDIR /app/funcdef
COPY ./funcdef .
WORKDIR /app
COPY devctl.yaml ./
COPY org.yaml ./
COPY user.production.yaml ./

# アプリケーションをビルド
WORKDIR /app
RUN npm run build

# 環境変数の設定
ENV NODE_ENV=production

# ポートの指定
EXPOSE 3000

# アプリケーションの起動
CMD ["npm", "start"]
