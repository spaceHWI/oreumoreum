from PIL import Image, ImageDraw, ImageFont
import numpy as np
from scipy import ndimage as ndi
FD='/home/claude/fonts/'
INK=(33,31,28);GYUL=(255,138,31);LEAF=(63,154,58);ALIEN=(143,208,106);EYE=(28,28,34);TIP=(255,210,63)
def draw_logo(font, size=220, track=0, squash=1.0, ink=INK):
    f=ImageFont.truetype(FD+font,size)
    chars='오름오름';W=size*5;Hh=int(size*1.6)
    im=Image.new('RGBA',(W,Hh),(0,0,0,0));d=ImageDraw.Draw(im)
    x=size*0.3;marks=[]
    for i,ch in enumerate(chars):
        g=Image.new('L',(int(size*1.4),Hh),0);ImageDraw.Draw(g).text((size*0.1,size*0.2),ch,font=f,fill=255)
        a=np.array(g)>128
        if ch=='오':
            # ㅇ 안쪽 구멍 찾기
            bg,_=ndi.label(~a);border=set(np.unique(np.concatenate([bg[0],bg[-1],bg[:,0],bg[:,-1]])))
            holes=[l for l in range(1,bg.max()+1) if l not in border]
            if holes:
                l=max(holes,key=lambda l:(bg==l).sum());ys,xs=np.nonzero(bg==l);cy,cx=ys.mean(),xs.mean()
                rin=np.sqrt((bg==l).sum()/np.pi)
                # 바깥 반지름: 가운데에서 왼쪽으로 먹이 끝나는 곳
                iy,ix=int(cy),int(cx)
                def reach(dy,dx):
                    r=int(rin*0.6)
                    while not a[iy+dy*r,ix+dx*r]: r+=1
                    while a[iy+dy*r,ix+dx*r]: r+=1
                    return r
                ry=reach(-1,0);rx=reach(0,-1)
                er=Image.new('L',g.size,0);ImageDraw.Draw(er).rectangle((cx-rx-8,0,cx+rx+8,cy+ry+2),fill=255)
                g=Image.fromarray((np.array(g)*(np.array(er)<128)).astype('uint8'))
                r=ry;RX=min(rx,ry*1.25)
        im.paste(Image.new('RGBA',g.size,ink+(255,)),(int(x),0),g)
        if ch=='오' and holes: marks.append((i,x+cx,cy,r,RX))
        bb=g.getbbox();x+= (f.getlength(ch)+track)
    d=ImageDraw.Draw(im)
    for i,cx,cy,r,RX in marks:
        R=r
        if i==0:
            d.ellipse((cx-RX,cy-R,cx+RX,cy+R),fill=GYUL)
            lx,ly=cx+R*0.15,cy-R*0.9
            d.polygon([(lx,ly),(lx+R*0.35,ly-R*0.45),(lx+R*0.95,ly-R*0.4),(lx+R*0.55,ly+R*0.05)],fill=LEAF)
        else:
            d.ellipse((cx-RX,cy-R,cx+RX,cy+R),fill=ALIEN)
            for k in(-1,1):
                ex=cx+k*R*0.38;ey=cy+R*0.05
                e=Image.new('RGBA',(int(R*0.7),int(R*0.9)),(0,0,0,0));ImageDraw.Draw(e).ellipse((0,0,e.size[0]-1,e.size[1]-1),fill=EYE)
                e=e.rotate(-k*22,expand=True,resample=Image.BICUBIC);im.alpha_composite(e,(int(ex-e.size[0]/2),int(ey-e.size[1]/2)))
                d=ImageDraw.Draw(im)
                x0,y0=cx+k*R*0.3,cy-R*0.9;x1,y1=cx+k*R*0.6,cy-R*1.35
                d.line((x0,y0,x1,y1),fill=ALIEN,width=max(4,int(R*0.13)));d.ellipse((x1-R*0.14,y1-R*0.14,x1+R*0.14,y1+R*0.14),fill=TIP)
    im=im.crop(im.getbbox())
    if squash!=1: im=im.resize((im.size[0],int(im.size[1]*squash)),Image.LANCZOS)
    return im
if __name__=='__main__':
    C=[('A  Black Han Sans','BlackHanSans-Regular.ttf',0,1),('B  Do Hyeon','DoHyeon-Regular.ttf',0,1),('C  Jua','Jua-Regular.ttf',0,1),('D  Bagel Fat One','BagelFatOne-Regular.ttf',0,1),('E  Black Han Sans 납작','BlackHanSans-Regular.ttf',0,0.82),('F  Gugi','Gugi-Regular.ttf',0,1)]
    lab=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc',34)
    cellW,cellH=1000,430;sheet=Image.new('RGB',(cellW*2,cellH*3),(251,246,230));d=ImageDraw.Draw(sheet)
    for n,(name,fn,tr,sq) in enumerate(C):
        lg=draw_logo(fn,220,tr,sq);s=min(820/lg.size[0],250/lg.size[1]);lg=lg.resize((int(lg.size[0]*s),int(lg.size[1]*s)),Image.LANCZOS)
        cx=(n%2)*cellW;cy=(n//2)*cellH
        sheet.paste(lg,(cx+(cellW-lg.size[0])//2,cy+90+(250-lg.size[1])//2),lg)
        d.text((cx+30,cy+20),name+f'   (가로:세로 {lg.size[0]/lg.size[1]:.1f}:1)',font=lab,fill=(120,110,95))
        lg.save(f'logo_{name[0]}.png')
    sheet.save('logo_drafts.png')
