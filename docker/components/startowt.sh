#!/bin/bash

# change workdir
cd /home/owt
ROOT='/home/owt'
export OWT_HOME=${ROOT}

# format the parameters
set -- $(getopt -u -l rabbit:,rabbit_user:,rabbit_pass:,mongo:,mongo_user:,mongo_pass:,hostname:,externalip:,network_interface:,component:,ssl::,ssl_crt:,ssl_key:,ssl_pass:,port:,processes:,prerun_processes:,max_processes:,enable_grp::,grp_host: -- -- "$@")
# get the parameters
while [ -n "$1" ]
do
  case "$1" in
    --rabbit ) rabbitmqip=$2; shift; shift ;;
    --rabbit_user ) rabbit_user=$2; shift; shift ;;
    --rabbit_pass ) rabbit_pass=$2; shift; shift ;;
    --mongo ) mongourl=$2; shift; shift ;;
    --mongo_user ) mongo_user=$2; shift; shift ;;
    --mongo_pass ) mongo_pass=$2; shift; shift ;;
    --hostname ) hostname=$2; shift; shift ;;
    --externalip ) externalip=$2; shift; shift ;;
    --network_interface ) networkinterface=$2; shift; shift ;;
    --component ) component=$2; shift; shift ;;
    --ssl )
      case "$2" in
        "") ssl=true; shift; shift ;;
        true) ssl=true; shift; shift ;;
        false) ssl=false; shift; shift ;;
        *) echo "option ssl must be true or false."; exit 1;
      esac ;;
    --ssl_crt ) ssl_crt=$2; shift; shift ;;
    --ssl_key ) ssl_key=$2; shift; shift ;;
    --ssl_pass ) ssl_pass=$2; shift; shift ;;
    --port ) port=$2; shift; shift ;;
    --processes ) processes=$2; shift; shift ;;
    --prerun_processes ) prerun_processes=$2; shift; shift ;;
    --max_processes ) max_processes=$2; shift; shift ;;
    --enable_grp )
      case "$2" in
        "") enable_grp=true; shift; shift ;;
        true) enable_grp=true; shift; shift ;;
        false) enable_grp=false; shift; shift ;;
        *) echo "option enable_grp must be true or false."; exit 1;
      esac ;;
    --grp_host ) grp_host=$2; shift; shift ;;
    * ) break;;
  esac
done

if [ -z "$ssl_crt" ]; then
  ssl_crt=$ROOT/cert/tls.crt
fi
if [ -z "$ssl_key" ]; then
  ssl_key=$ROOT/cert/tls.key
fi

if [ -z "${mongourl}" ];then
    echo "mongourl is required!"
    exit 1
fi
if [ -z "${enable_grp}" ] || [ "$enable_grp" = 'false' ]; then
  if [ -z "${rabbitmqip}" ]; then
    echo "rabbitmqip is required!"
    exit 1
  fi
else
  if [ -z "$grp_host" ]; then
    echo "grp_host is required when enable_grp is true!"
    exit 1
  fi
fi

alltoml=$(find . -maxdepth 2 -name "*.toml")
echo ${mongourl}
if [ ! -z "${rabbitmqip}" ]; then
  echo ${rabbitmqip}
fi
for toml in $alltoml; do
  if [ ! -z "${mongourl}" ];then
    sed -i "/^dataBaseURL = /c \dataBaseURL = \"${mongourl}\"" $toml  
  fi

  if [ ! -z "${rabbitmqip}" ];then
    if [[ $toml == *"management_console"* ]]; then
     echo "Do not modify management_console"
    else
      sed -i "/^host = /c \host = \"${rabbitmqip}\"" $toml
    fi
 
  fi
done

if [ ! -z "${hostname}" ];then
    echo ${hostname}
    sed -i "/^hostname = /c \hostname = \"${hostname}\"" portal/portal.toml  
fi

if [ ! -z "${externalip}" ];then
    echo ${externalip}
    if [ ! -z "${network_interface}" ];then
        sed -i "/^network_interfaces =/c \network_interfaces = [{name = \"${networkinterface}\", replaced_ip_address = \"${externalip}\"}]" webrtc_agent/agent.toml
    fi
    sed -i "/^ip_address = /c \ip_address =  \"${externalip}\"" portal/portal.toml  
fi

CommandDir=${component//-/_}

# config_ssl config_file_path true_or_false
config_ssl()
{
  config_file_path=$1
  true_or_false=$2
  if [ ! -z "$true_or_false" ]; then
    if [ "$true_or_false" = 'false' ]; then
      sed -i "/^ssl = true/c \ssl = false" "$config_file_path"
    fi
    if [ "$true_or_false" = 'true' ]; then
      sed -i "/^ssl = false/c \ssl = true" "$config_file_path"
      if [ ! -z "$ssl_pass" ] && [ -e "$ssl_key" ] && [ -e "$ssl_crt" ]; then
        pfx_file=cert/certificate.pfx
        openssl pkcs12 -export -out $pfx_file -inkey "$ssl_key" -in "$ssl_crt" -password "pass:$ssl_pass"
        node setcert.js "$ssl_pass"
      fi
    fi
  fi
}

config_grp()
{
  config_file_path=$1
  true_or_false=$2
  if [ ! -z "$true_or_false" ]; then
    if [ "$true_or_false" = 'true' ]; then
      sed -i "/^#enable_grpc = true/c \enable_grpc = true" "$config_file_path"
      sed -i "/^#grpc_host = \"localhost:10080\"/c \grpc_host = \"$grp_host\"" "$config_file_path"
      sed -i "s/^\[cluster]/[cluster]\nhost = \"$grp_host\"/" "$config_file_path"
    fi
  fi
}

# config_port config_file_path old_port new_port
config_port()
{
  config_file_path=$1
  old_port=$2
  new_port=$3
  if [ ! -z "$new_port" -a "$old_port" != "$new_port" ]; then
    sed -i "/^port = ${old_port}/c \port = ${new_port}" "$config_file_path"
  fi
}

# config_rabbit
config_rabbit()
{
  if [ ! -z "$rabbit_user" ] && [ ! -z "$rabbit_pass" ]; then
    echo "setting rabbit user name and password..."
    node setauth --rabbitmq "$rabbit_user" "$rabbit_pass"
    echo "rabbit user name and password setted."
  fi
}

# config_mongo
config_mongo()
{
  if [ ! -z "$mongo_user" ] && [ ! -z "$mongo_pass" ]; then
    echo "setting mongo user name and password..."
    node setauth --mongodb "$mongo_user" "$mongo_pass"
    echo "mongo user name and password setted."
  fi
}

# config_port config_file_path
config_processes()
{
  config_file_path=$1
  if [ ! -z "$prerun_processes" ]; then
    sed -i "/^prerunProcesses = /c \prerunProcesses = ${prerun_processes}" "$config_file_path"
  fi
  if [ ! -z "$max_processes" ]; then
    sed -i "/^maxProcesses = /c \maxProcesses = ${max_processes}" "$config_file_path"
  fi
  if [ ! -z "$processes" ]; then
    sed -i "/^numberOfProcess = /c \numberOfProcess = ${processes}" "$config_file_path"
    if [ -z "$prerun_processes" ] && [ -z "$max_processes" ]; then
      sed -i "/^prerunProcesses = /c \prerunProcesses = ${processes}" "$config_file_path"
      sed -i "/^maxProcesses = /c \maxProcesses = ${processes}" "$config_file_path"
    fi 
  fi
}

check_node_version()
{
  if ! hash node 2>/dev/null; then
    echo >&2 "Error: node not found. Please install node ${NODE_VERSION} first."
    return 1
  fi
  local NODE_VERSION=v$(node -e "process.stdout.write(require('${ROOT}/package.json').engine.node)")
  NODE_VERSION=$(echo ${NODE_VERSION} | cut -d '.' -f 1)
  local NODE_VERSION_USE=$(node --version | cut -d '.' -f 1)
  [[ ${NODE_VERSION} == ${NODE_VERSION_USE} ]] && return 0 || (echo "node version not match. Please use node ${NODE_VERSION}"; return 1;)
}

check_node_version || exit 1
echo "starting $component..."

case ${component} in
    management-api )
    cd ${OWT_HOME}/management_api
    config_rabbit
    config_grp management_api.toml $enable_grp
    config_mongo
    config_processes management_api.toml
    config_ssl management_api.toml $ssl
    config_port management_api.toml 3000 $port
    ./init.sh --dburl="${mongourl}" << 'EOF'
y
EOF
    node .
    ;;
    cluster-manager )
    cd ${OWT_HOME}/cluster_manager
    config_rabbit
    config_grp cluster_manager.toml $enable_grp
    config_mongo
    node .
    ;;
    portal )
    cd ${OWT_HOME}/portal
    config_rabbit
    config_grp portal.toml $enable_grp
    config_mongo
    config_ssl portal.toml $ssl
    config_port portal.toml 8080 $port
    node .
    ;;
    event-bridge )
    cd ${OWT_HOME}/eventbridge
    export LD_LIBRARY_PATH=./lib:${LD_LIBRARY_PATH}
    config_rabbit
    config_grp agent.toml $enable_grp
    config_mongo
    config_processes agent.toml
    node .
    ;;
    conference-agent )
    cd ${OWT_HOME}/conference_agent
    config_rabbit
    config_grp agent.toml $enable_grp
    config_mongo
    config_processes agent.toml
    node . -U conference
    ;;
    webrtc-agent )
    cd ${OWT_HOME}/webrtc_agent
    export LD_LIBRARY_PATH=./lib:${LD_LIBRARY_PATH}
    config_rabbit
    config_grp agent.toml $enable_grp
    config_mongo
    config_processes agent.toml
    node . -U webrtc
    ;;
    streaming-agent )
    cd ${OWT_HOME}/streaming_agent
    export LD_LIBRARY_PATH=./lib:${LD_LIBRARY_PATH}
    config_rabbit
    config_grp agent.toml $enable_grp
    config_mongo
    config_processes agent.toml
    node . -U streaming
    ;;
    recording-agent )
    cd ${OWT_HOME}/recording_agent
    export LD_LIBRARY_PATH=./lib:${LD_LIBRARY_PATH}
    config_rabbit
    config_grp agent.toml $enable_grp
    config_mongo
    config_processes agent.toml
    node . -U recording
    ;;
    sip-agent )
    cd ${OWT_HOME}/sip_agent
    export LD_LIBRARY_PATH=./lib:${LD_LIBRARY_PATH}
    config_rabbit
    config_grp agent.toml $enable_grp
    config_mongo
    config_processes agent.toml
    node . -U sip
    ;;
    sip-portal )
    cd ${OWT_HOME}/sip_portal
    config_rabbit
    config_grp sip_portal.toml $enable_grp
    config_mongo
    node sip_portal.js
    ;;
    audio-agent )
    cd ${OWT_HOME}/audio_agent
    export LD_LIBRARY_PATH=./lib:${LD_LIBRARY_PATH}
    config_rabbit
    config_grp agent.toml $enable_grp
    config_mongo
    config_processes agent.toml
    node . -U audio
    ;;
    video-agent )
    cd ${OWT_HOME}/video_agent
    export LD_LIBRARY_PATH=./lib:${LD_LIBRARY_PATH}
    export PATH=./bin:/opt/intel/mediasdk/bin:${PATH}
    config_rabbit
    config_grp agent.toml $enable_grp
    config_mongo
    config_processes agent.toml
    node . -U video
    ;;
    quic-agent )
    cd ${OWT_HOME}/quic_agent
    export LD_LIBRARY_PATH=./lib:${LD_LIBRARY_PATH}
    config_rabbit
    config_grp agent.toml $enable_grp
    config_mongo
    config_port agent.toml 7700 $port
    config_processes agent.toml
    node . -U quic
    ;;
    media-bridge )
    cd ${OWT_HOME}/media_bridge
    export LD_LIBRARY_PATH=./lib:${LD_LIBRARY_PATH}
    config_rabbit
    config_grp agent.toml $enable_grp
    config_mongo
    config_processes agent.toml
    node . -U mediabridge
    ;;
    analytics-agent )
    cd ${OWT_HOME}/analytics_agent
    export LD_LIBRARY_PATH=./lib:${LD_LIBRARY_PATH}
    export PATH=./bin:/opt/intel/mediasdk/bin:${PATH}
    export CONFIGFILE_PATH=./plugin.cfg
    config_rabbit
    config_grp agent.toml $enable_grp
    config_mongo
    config_processes agent.toml
    node . -U analytics
    ;;
    management-console )
    cd ${OWT_HOME}/management_console
    config_rabbit
    config_grp management_console.toml $enable_grp
    config_mongo
    config_ssl management_console.toml $ssl
    config_port management_console.toml 3300 $port
    node .
    ;;
    app )
    cd ${OWT_HOME}/apps/current_app/
    node .
    ;;
    * )
    if [ -d ${OWT_HOME}/${CommandDir} ]; then
        cd ${OWT_HOME}/${CommandDir}
        config_rabbit
        config_mongo
        StartCmd=$(node -e "process.stdout.write(require('./package.json').scripts.start)")
        ${StartCmd}
    else
        echo $usage
        exit 1
    fi
    ;;
esac