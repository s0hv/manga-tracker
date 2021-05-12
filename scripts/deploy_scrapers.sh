#!/bin/bash

# exit when any command fails
set -e

# ANSI colors
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

cd "$(dirname "$0")"/..

if [ ! -f venv/bin/activate ]
  then
    echo -e >&2 "${RED}No virtual environment found in venv/bin/activate. Install a virtual environment first${NC}" |& tee -a $filename
    exit 1
fi

mkdir -p logs
filename=$(date '+logs/buildLog_%Y-%m-%d_%H-%M.log')
process_name=scraper-pm2.json
unbuffer=unbuffer
type $unbuffer >/dev/null 2>&1 || {
  echo -e >&2 "${YELLOW}Unbuffer not installed. Colored output not supported.
  Install unbuffer with 'sudo apt-get install expect-dev'${NC}
  " |& tee -a $filename;
  unbuffer='';
}

echo "Stopping process" |& tee -a $filename
$unbuffer pm2 stop $process_name |& tee -a $filename
$unbuffer pm2 delete $process_name |& tee -a $filename

echo "Running git pull" |& tee -a $filename
$unbuffer git pull |& tee -a $filename
if [ ${PIPESTATUS[0]} -ne 0 ]
  then
    echo -e >&2 "${RED}Failed to git pull${NC}" |& tee -a $filename
    exit 1
fi

source venv/bin/activate

echo "Upgrading requirements" |& tee -a $filename
$unbuffer pip install -r requirements.txt --upgrade |& tee -a $filename
if [ ${PIPESTATUS[0]} -ne 0 ]
  then
    echo -e >&2 "${RED}Failed to install requirements. Manual fixes required${NC}" |& tee -a $filename
    exit 1
fi

echo "Loading .env" |& tee -a $filename
set -a # automatically export all variables
source .env
set +a


echo "Starting application" |& tee -a $filename
$unbuffer pm2 start $process_name |& tee -a $filename
deactivate
echo "Deployment successful. Logs can be found in" $filename |& tee -a $filename
