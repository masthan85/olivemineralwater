import sys, math, numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from cfg import CFG
from labels import detect_curve
FONT='/usr/share/texmf/fonts/opentype/public/tex-gyre/texgyrepagella-regular.otf'
TEXT='Product of United Kingdom'
SS=4  # supersampling for glyphs and flag

def union_jack(w,h):
    """Union Jack, w:h, drawn with anti-aliasing (supersampled)."""
    W,H=w*SS,h*SS
    yy,xx=np.mgrid[0:H,0:W].astype(np.float32)+0.5
    u=H/30.0  # official 30-unit height
    cx,cy=W/2,H/2
    img=np.zeros((H,W,3),np.float32); img[:]=(1,33,105)
    X=(xx-cx); Y=(yy-cy)
    # diagonals: lines through centre with slope +-H/W
    k=H/W; n=math.sqrt(1+k*k)
    d1=(Y-k*X)/n   # distance to diagonal top-left -> bottom-right (y = kx)
    d2=(Y+k*X)/n   # distance to the other diagonal
    white=(np.abs(d1)<3*u)|(np.abs(d2)<3*u)
    img[white]=(255,255,255)
    # counterchanged red saltire, 2u wide, offset to the clockwise side
    red=np.zeros_like(white)
    # quadrant signs
    q_left=X<0; q_top=Y<0
    # diagonal d1 runs through TL and BR quadrants; d2 through TR and BL
    red|=(q_left&q_top)&(d1>0)&(d1<2*u)        # top-left arm: red below the centre line
    red|=(~q_left&~q_top)&(d1<0)&(d1>-2*u)     # bottom-right arm: red above
    red|=(~q_left&q_top)&(d2<0)&(d2>-2*u)      # top-right arm
    red|=(q_left&~q_top)&(d2>0)&(d2<2*u)       # bottom-left arm
    img[red]=(200,16,46)
    # St George's cross with white fimbriation
    img[(np.abs(X)<5*u)|(np.abs(Y)<5*u)]=(255,255,255)
    img[(np.abs(X)<3*u)|(np.abs(Y)<3*u)]=(200,16,46)
    im=Image.fromarray(img.astype(np.uint8)).resize((w,h),Image.LANCZOS)
    return im

class Curve:
    def __init__(self,c,S): self.c=np.array(c,float); self.S=S
    def y(self,x): return self.S*np.polyval(self.c,x/self.S)
    def dy(self,x): return np.polyval(np.polyder(self.c),x/self.S)
    def offset_pt(self,x,d):
        s=self.dy(x); n=math.sqrt(1+s*s); return x+d*s/n, self.y(x)-d/n, math.atan(s)

def place_on_curve(curve, x_center, total_w, offset):
    """Map arc length along the offset curve to x. Returns function s->(x,y,angle)."""
    xs=np.linspace(x_center-total_w*1.5,x_center+total_w*1.5,6000)
    P=np.array([curve.offset_pt(x,offset) for x in xs])
    seg=np.hypot(np.diff(P[:,0]),np.diff(P[:,1])); s=np.concatenate([[0],np.cumsum(seg)])
    # arc length at x_center
    s0=np.interp(x_center,xs,s)
    def at(t):  # t = signed arc length from centre
        si=s0+t; return (np.interp(si,s,P[:,0]),np.interp(si,s,P[:,1]),np.interp(si,s,P[:,2]))
    return at

def paste_rot(base, sprite, cx, cy, ang):
    """sprite RGBA centred at (cx,cy) of its anchor = sprite centre; rotate by ang (radians, image coords)."""
    r=sprite.rotate(-math.degrees(ang),resample=Image.BICUBIC,expand=True)
    base.alpha_composite(r,(int(round(cx-r.width/2)),int(round(cy-r.height/2))))

def draw_label(img, curve, x_center, width_px, ink):
    """img RGBA final-res. width_px = target width of text+flag."""
    # find font size giving the target width
    size=40
    for _ in range(3):
        f=ImageFont.truetype(FONT,size*SS)
        tw=f.getlength(TEXT)/SS; cap=(f.getbbox('H')[3]-f.getbbox('H')[1])/SS
        fh=cap*1.02; fw=fh*5/3; gap=0.42*size
        total=tw+gap+fw; size=size*width_px/total
    size=max(6,size)
    f=ImageFont.truetype(FONT,int(round(size*SS)))
    tw=f.getlength(TEXT)/SS
    asc,desc=f.getmetrics(); desc/=SS
    capb=f.getbbox('H'); cap=(capb[3]-capb[1])/SS
    fh=cap*1.02; fw=fh*5/3; gap=0.42*size
    total=tw+gap+fw
    base_off=desc*0.95+size*0.14  # baseline distance above the border's inner edge
    at=place_on_curve(curve,x_center,total,base_off)
    if ink=='gold': top,bot,sh=(246,224,160),(205,163,84),(0,0,0,110)
    elif ink=='cream': top,bot,sh=(252,248,228),(226,214,170),(0,0,0,120)
    elif ink=='green': top,bot,sh=(30,92,52),(18,64,36),None
    # glyph sprite size
    pad=int(size*SS*0.6); boxw=int(size*SS*2)+2*pad; boxh=int((asc/SS+desc)*SS)+2*pad
    for i,ch in enumerate(TEXT):
        if ch==' ': continue
        x0=f.getlength(TEXT[:i])/SS; wch=f.getlength(ch)/SS
        t=-total/2+x0+wch/2
        px,py,ang=at(t)
        # draw glyph with middle-baseline anchor at sprite centre
        m=Image.new('L',(boxw,boxh),0); ImageDraw.Draw(m).text((boxw/2,boxh/2),ch,font=f,fill=255,anchor='ms',stroke_width=max(1,int(round(size*SS*0.018))),stroke_fill=255)
        # vertical gradient fill (cap height span)
        g=np.zeros((boxh,boxw,3),np.float32); yy=np.arange(boxh)[:,None]
        tt=np.clip((yy-(boxh/2-cap*SS))/(cap*SS),0,1)
        for k in range(3): g[...,k]=top[k]*(1-tt)+bot[k]*tt
        spr=Image.fromarray(np.dstack([g.astype(np.uint8),np.asarray(m)]),'RGBA')
        spr=spr.resize((boxw//SS,boxh//SS),Image.LANCZOS)
        if sh:
            sm=m.filter(ImageFilter.GaussianBlur(SS*max(0.6,size*0.035))).resize((boxw//SS,boxh//SS),Image.LANCZOS)
            sa=np.asarray(sm).astype(np.float32)*sh[3]/255
            shs=Image.fromarray(np.dstack([np.zeros((sm.height,sm.width,3),np.uint8),sa.astype(np.uint8)]),'RGBA')
            o=size*0.045; paste_rot(img,shs,px+o*math.sin(-ang)*0+o*0.3,py+o,ang)
        paste_rot(img,spr,px,py,ang)
    # flag: bottom on baseline, centred at its own arc position
    t=-total/2+tw+gap+fw/2
    px,py,ang=at(t)
    fl=union_jack(int(round(fw)),int(round(fh))).convert('RGBA')
    # thin gold/white keyline like a printed flag edge
    fl2=Image.new('RGBA',(fl.width+2,fl.height+2),(0,0,0,0)); fl2.paste(fl,(1,1))
    ImageDraw.Draw(fl2).rectangle([0,0,fl2.width-1,fl2.height-1],outline=(*bot,200) if ink=='gold' else (180,180,180,200))
    # centre of flag lies fh/2 above baseline along the normal
    cx=px+math.sin(ang)*fh/2; cy=py-math.cos(ang)*fh/2
    if sh:
        s=Image.new('RGBA',fl2.size,(0,0,0,90)).filter(ImageFilter.GaussianBlur(1))
        paste_rot(img,s,cx+0.5,cy+size*0.05,ang)
    paste_rot(img,fl2,cx,cy,ang)

def run(k, S=2.5, src_x4=None, out=None):
    C=CFG[k]
    s1=np.asarray(Image.open(f'work/{k}_s1.png').convert('RGB'))
    x4=Image.open(src_x4 or f'work/{k}_x4.png').convert('RGB')
    W,H=int(round(s1.shape[1]*S)),int(round(s1.shape[0]*S))
    img=x4.resize((W,H),Image.LANCZOS).convert('RGBA')
    for L in C['labels']:
        c,pts=detect_curve(s1,L['guide'],L['xr'],sign=L.get('sign',1))
        cur=Curve(c,S)
        xc=S*(L['xr'][0]+L['xr'][1])/2
        frac=L.get('w',0.6)
        draw_label(img,cur,xc,frac*S*(L['xr'][1]-L['xr'][0]),C['ink'])
    img=img.convert('RGB')
    img.save(out or f'work/{k}_final.png')
    return img
if __name__=='__main__':
    k=sys.argv[1]; src=sys.argv[2] if len(sys.argv)>2 else None
    run(k,src_x4=src)
