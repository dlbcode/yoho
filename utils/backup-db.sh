#!/bin/bash

if [ $# -eq 0 ] ; then
    echo 'Please provide a path to store the backup'
    echo 'Example: ./backup-db.sh /home/user/backup'
    exit 1
fi

mongodump --uri="mongodb://rsuser:rspass@localhost:27017/rsdb" --out=$1


