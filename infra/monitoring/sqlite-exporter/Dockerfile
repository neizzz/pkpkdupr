FROM golang:1.25-alpine AS builder

WORKDIR /src

RUN CGO_ENABLED=0 GOOS=linux \
    go install github.com/erfanmomeniii/sqlite_exporter/cmd/sqlite_exporter@latest

FROM alpine:3.22

COPY --from=builder /go/bin/sqlite_exporter /usr/local/bin/sqlite_exporter

EXPOSE 9697

ENTRYPOINT ["/usr/local/bin/sqlite_exporter"]
