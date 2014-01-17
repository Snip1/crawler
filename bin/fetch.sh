ps -w | grep "fetch.js $1" | grep -v grep | awk '{print $1}' | xargs kill
while :
do
/usr/local/bin/node $(dirname $0)/fetch.js $1
echo 'next hop...'
done