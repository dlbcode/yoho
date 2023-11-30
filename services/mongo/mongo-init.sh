#!/bin/bash
set -e
mongosh -- "$MONGO_INITDB_DATABASE" <<EOF
var rootUser = 'rsroot';
var rootPassword = '$MONGO_INITDB_ROOT_PASSWORD';
var admin = db.getSiblingDB('admin');
admin.auth(rootUser, rootPassword);

var user = 'rsuser';
var passwd = '$MONGO_RSUSER_PASSWORD';
db.createUser({user: user, pwd: passwd, roles: [{role: 'readWrite', db: '$MONGO_INITDB_DATABASE'}]});
EOF