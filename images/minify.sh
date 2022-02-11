#!/usr/bin/zsh

for img in *.svg; do
	if [[ ! $img =~ ".min.svg" ]]; then
		svgo --config=svgo.json $img -o ${img:r}.min.svg
		# svgo --config=svgo.json $img --datauri=base64 -o ${img:r}.min.uri
	fi
done
