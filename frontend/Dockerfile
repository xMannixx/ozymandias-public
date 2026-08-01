FROM node:22-alpine AS build
WORKDIR /app

ARG VITE_AUTH_BYPASS=false
ENV VITE_AUTH_BYPASS=$VITE_AUTH_BYPASS

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

FROM alpine:3.21
COPY --from=build /app/dist /dist
# Clear /output first: without it every rebuild leaves its hashed assets behind
# in the shared volume, which grows forever and makes debugging ambiguous.
CMD ["sh", "-c", "rm -rf /output/* 2>/dev/null; cp -r /dist/* /output/ 2>/dev/null; echo 'Frontend files copied'; sleep infinity"]
