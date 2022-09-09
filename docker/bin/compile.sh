#!/bin/bash

echo '[info]  Compiling your L4T code.'
/usr/local/bin/l4tc 1> ./out.S
if [ $? -gt 0 ]; then
  echo '[error] Failed to compile your code. Please check the error message above.' >&2
  exit 1
fi
echo '[info]  Successfully compiled your code.'
cat ./out.S