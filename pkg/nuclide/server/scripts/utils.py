# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

from __future__ import print_function

import httplib
import json
import os
import socket
import subprocess
import sys

# Run the process silently without stdout and stderr.
# On success, return stdout. Otherwise, raise CalledProcessError
# with combined stdout and stderr.
def check_output_silent(args, cwd=None, env=None):
    # Use Popen here. check_ouput is not available in Python 2.6.
    # cwd=None means don't change cwd.
    # env=None means inheriting the current process' environment.
    process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=cwd, env=env)
    out, err = process.communicate()
    if process.returncode != 0:
        error = subprocess.CalledProcessError(process.returncode, args)
        error.output = out + err
        raise error
    else:
        return out

# It supports https if key_file and cert_file are given.
def http_get(host, port, method, url, key_file=None, cert_file=None, timeout=1):
    conn = None
    if key_file is not None and cert_file is not None:
        conn = httplib.HTTPSConnection(host, port, key_file=key_file,cert_file=cert_file, timeout=timeout)
    else:
        conn = httplib.HTTPConnection(host, port, timeout=timeout)
    try:
        conn.request(method, url)
        response = conn.getresponse()
        if response.status == 200:
            ret = response.read()
            return ret
        else:
            return None
    except:
        return None
    finally:
        if conn:
            conn.close()

def is_ip_address(addr):
    try:
        # Check ipv4 address.
        socket.inet_aton(addr)
        return True
    except socket.error:
        pass

    try:
        # Check ipv6 address.
        socket.inet_pton(socket.AF_INET6, addr)
        return True
    except socket.error:
        return False
