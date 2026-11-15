
import os
d=os.path.dirname(os.path.abspath(__file__))
L=open(d+'/namsongi.html').read().split('\n')
data='\n'.join(l for l in L if l.startswith('const RIM=') or l.startswith('const NEAR='))
rm=open(d+'/../oreum/src/runnermodel.js').read().replace('export const RM','const RM')
p=open(d+'/page.html').read()
def out(three):
    return p.replace('/*THREE*/',three).replace('/*DATA*/',data).replace('/*RM*/',rm)
os.makedirs(d+'/dist',exist_ok=True)
open(d+'/dist/namsongi-draft.html','w').write(out('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/0.149.0/three.min.js"></script>'))
t=open(d+'/three.min.js').read()
open(d+'/dist/test.html','w').write('<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>body{margin:0}</style></head><body>'+out('<script>'+t+'</script>')+'</body></html>')
print(len(out('')))
