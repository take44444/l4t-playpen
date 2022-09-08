#!/bin/bash

echo '[info]  Compiling your L4T code.'
/usr/local/bin/l4tc < "$@" 1> ./out.S
if [ $? -gt 0 ]; then
  echo '[error] Failed to compile your L4T code. Please check the error message above.' >&2
  exit 1
fi
gcc-9 -o out out.S
if [ $? -gt 0 ]; then
  echo '[error] Failed to assemble. Please report to the developer.' >&2
  exit 1
fi
echo '[info]  Successfully compiled your L4T code.'
echo '[info]  Executing your L4T code.'
./out
echo "[info]  Execution completed with exit code $?."