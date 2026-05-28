FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY go.mod ./
RUN go mod download

COPY . .
RUN rm -f go.sum && go mod tidy && CGO_ENABLED=0 GOOS=linux go build -o sfu-server .

FROM alpine:3.19

RUN apk --no-cache add ca-certificates

COPY --from=builder /app/sfu-server /usr/local/bin/sfu-server

EXPOSE 8080

CMD ["sfu-server"]
