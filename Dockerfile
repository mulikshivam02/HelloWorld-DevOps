# ---- Stage 1: Build the React app ----
FROM node:18-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# CRA bakes REACT_APP_* vars in at BUILD time, not runtime.
# Pass them as build args so the same Dockerfile works for every environment.
ARG REACT_APP_BASE_URL
ARG REACT_APP_RAZORPAY_KEY
ENV REACT_APP_BASE_URL=${REACT_APP_BASE_URL} \
    REACT_APP_RAZORPAY_KEY=${REACT_APP_RAZORPAY_KEY}

RUN npm run build

# ---- Stage 2: Serve with nginx ----
FROM nginx:1.25-alpine AS production
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
