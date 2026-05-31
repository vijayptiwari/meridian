FROM mcr.microsoft.com/playwright:v1.49.1-jammy

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

ENV JOB_AGENT_UI_HOST=0.0.0.0
ENV JOB_AGENT_UI_PORT=3030
ENV MERIDIAN_SKIP_PLAYWRIGHT_INSTALL=1

EXPOSE 3030

CMD ["npm", "run", "ui"]
