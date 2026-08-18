#!/bin/bash
set -eu

minim_root=/opt/minimserver/minimserver
state_dir="${HOME}/.local/state/minimserver-watchdog"
state_file="${state_dir}/network-state"
lock_file="${state_dir}/watchdog.lock"

mkdir -p "${state_dir}"
exec 9>"${lock_file}"
flock -n 9 || exit 0

boot_id=$(cat /proc/sys/kernel/random/boot_id)
lan_ip=$(ip -4 route get 192.168.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "src") {print $(i+1); exit}}')

if [ -z "${lan_ip}" ] || ! ping -c 1 -W 2 192.168.1.1 >/dev/null 2>&1; then
  logger -t minimserver-watchdog "LAN/router is not ready; retrying on the next timer run"
  exit 1
fi

previous_boot=
previous_ip=
if [ -r "${state_file}" ]; then
  read -r previous_boot previous_ip <"${state_file}" || true
fi

if [ "${1:-}" = "--initialize" ]; then
  printf '%s %s\n' "${boot_id}" "${lan_ip}" >"${state_file}"
  exit 0
fi

reason=
if [ "${previous_boot}" != "${boot_id}" ]; then
  reason="first delayed check after boot"
elif [ "${previous_ip}" != "${lan_ip}" ]; then
  reason="LAN address changed from ${previous_ip:-unknown} to ${lan_ip}"
elif ! pgrep -f 'java -jar /opt/minimserver/minimserver/lib/mserver.jar' >/dev/null; then
  reason="MinimServer process is missing"
elif ! ss -lnt | awk -v endpoint="${lan_ip}:9791" '$4 == endpoint {found=1} END {exit !found}'; then
  reason="MinimServer is not listening on ${lan_ip}:9791"
fi

if [ -n "${reason}" ]; then
  logger -t minimserver-watchdog "Recovery triggered: ${reason}"
  if pgrep -f 'java -jar /opt/minimserver/minimserver/lib/mserver.jar' >/dev/null; then
    "${minim_root}/bin/mscript" -c restart
  else
    "${minim_root}/bin/startd"
  fi
  sleep 10
  ss -lnt | awk -v endpoint="${lan_ip}:9791" '$4 == endpoint {found=1} END {exit !found}'
  logger -t minimserver-watchdog "Recovery successful on ${lan_ip}"
fi

printf '%s %s\n' "${boot_id}" "${lan_ip}" >"${state_file}"
