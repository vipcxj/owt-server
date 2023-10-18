#!/bin/bash
set -e
CUR_DIR=`readlink -f $(dirname $0)`
cd $CUR_DIR
docker build -t swr.cn-east-3.myhuaweicloud.com/sanrong/owt-component:run .
docker push swr.cn-east-3.myhuaweicloud.com/sanrong/owt-component:run