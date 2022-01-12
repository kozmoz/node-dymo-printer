#!/bin/sh
#
#   Add package.json files to cjs/ems subtrees
#

cat >dist/cjs/package.json <<!EOF
{
    "type": "commonjs"
}
!EOF

cat >dist/esm/package.json <<!EOF
{
    "type": "module"
}
!EOF
