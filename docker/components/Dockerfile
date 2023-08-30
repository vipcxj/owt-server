FROM ubuntu:18.04 AS owt-run
LABEL Description="This is the image for building OWT on Ubuntu 18.04 without mongodb and rabbitmq bundled"
LABEL maintainer="vipcxj"
WORKDIR /home

# Prerequisites
# Install node
ARG NODE_VER=v14.19.0
ARG NODE_REPO=https://nodejs.org/dist/${NODE_VER}/node-${NODE_VER}-linux-x64.tar.xz

RUN DEBIAN_FRONTEND=noninteractive apt-get update && apt-get install -y -q --no-install-recommends ca-certificates wget xz-utils libboost-system-dev libboost-thread-dev liblog4cxx-dev libglib2.0-0 libfreetype6-dev libgstreamer-plugins-base1.0-0 curl sudo

RUN wget ${NODE_REPO} && \
    tar xf node-${NODE_VER}-linux-x64.tar.xz && \
    cp node-*/* /usr/local -rf && rm -rf node-*

RUN useradd -m owt && echo "owt:owt" | chpasswd && adduser owt sudo
COPY --chown=owt:owt --from=owt:build /home/owt-server/dist /home/owt
COPY --chown=owt:owt startowt.sh /home/
RUN chmod +x ./startowt.sh

USER owt
RUN cd /home/owt && bash ./video_agent/install_openh264.sh

CMD /bin/bash
ENV LD_LIBRARY_PATH=${LD_LIBRARY_PATH}:/usr/local/lib/x86_64-linux-gnu