#!/bin/sh

rm -rf ssl
mkdir ssl
cd ssl

# certificate authority

openssl genrsa -out ca.key.pem 2048

openssl req -x509 -new -nodes \
  -key ca.key.pem \
  -days 9999 \
  -out ca.crt.pem \
  -subj "/C=US/ST=California/L=Mountain View/O=Appc Signing Authority/CN=example.com"

# server

openssl genrsa -out server.key.pem 2048

openssl req -new \
  -key server.key.pem \
  -out csr.pem \
  -subj "/C=US/ST=California/L=Mountain View/O=Appc Test/CN=example.com"

openssl x509 -req -in csr.pem \
  -CA ca.crt.pem \
  -CAkey ca.key.pem \
  -CAcreateserial \
  -out server.crt.pem \
  -days 500

rm -f csr.pem

openssl rsa \
  -in server.key.pem \
  -pubout -out public.key.pem

cat server.crt.pem ca.crt.pem > server.chain.pem

# client

openssl genrsa -out client.key.pem 2048

openssl req -new \
  -key client.key.pem \
  -out csr.pem \
  -subj "/C=US/ST=California/L=Mountain View/O=Appc Test/CN=example.com"

openssl x509 -req -in csr.pem \
  -CA ca.crt.pem \
  -CAkey ca.key.pem \
  -CAcreateserial \
  -out client.crt.pem \
  -days 500

rm -f csr.pem

openssl rsa \
  -in client.key.pem \
  -pubout -out public.key.pem

cat client.crt.pem ca.crt.pem > client.chain.pem

echo "Success!"
