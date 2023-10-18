#!/bin/bash

tar -czh . | docker build -t swr.cn-east-3.myhuaweicloud.com/sanrong/owt-init-service:latest -
docker push swr.cn-east-3.myhuaweicloud.com/sanrong/owt-init-service:latest