FROM centos:6.6


RUN yum install -y initscripts curl tar gcc libc6-dev git

ENV GOLANG_VERSION 1.8.1

RUN curl -sSL https://golang.org/dl/go$GOLANG_VERSION.linux-amd64.tar.gz \
                | tar -v -C /usr/local -xz
ENV PATH $PATH:/usr/local/go/bin

ENV GOPATH /go
ENV PATH /go/bin:$PATH

WORKDIR /go/src/github.com/grafana/grafana
ADD . ./
RUN go run build.go setup
RUN go run build.go build
