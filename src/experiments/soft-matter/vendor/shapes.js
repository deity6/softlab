import * as T from 'three';

// Closed, rounded candy silhouettes. Character details are embedded in the gel.
const outlines={
  watermelon:[[-1.64,-.86],[-1.28,-.24],[-.7,.65],[-.22,1.4],[.06,1.52],[.34,1.36],[.91,.48],[1.42,-.35],[1.7,-.86],[1.59,-1.05],[.83,-1.2],[0,-1.25],[-.88,-1.18],[-1.6,-1.04]],
  star:[[0,1.65],[-.51,.62],[-1.58,.43],[-.91,-.35],[-.96,-1.43],[0,-.94],[.96,-1.43],[.91,-.35],[1.58,.43],[.51,.62]],
  bear:[[-.12,-1.28],[-.35,-1.51],[-.78,-1.53],[-.98,-1.34],[-.96,-.98],[-.83,-.61],[-1.13,-.63],[-1.32,-.39],[-1.26,-.08],[-.98,.26],[-.49,.32],[-.70,.51],[-.86,.81],[-.89,1.13],[-1.10,1.40],[-1.09,1.68],[-.87,1.82],[-.65,1.70],[-.59,1.61],[-.32,1.78],[0,1.84],[.32,1.78],[.59,1.61],[.65,1.70],[.87,1.82],[1.09,1.68],[1.10,1.40],[.89,1.13],[.86,.81],[.70,.51],[.49,.32],[.98,.26],[1.26,-.08],[1.32,-.39],[1.13,-.63],[.83,-.61],[.96,-.98],[.98,-1.34],[.78,-1.53],[.35,-1.51],[.12,-1.28]],
  // Added on top of the reference: a rounded square for the abstract "sugar
  // cube" preset. CatmullRom rounds the four corners for us.
  cube:[[-1.08,-1.08],[1.08,-1.08],[1.08,1.08],[-1.08,1.08]],
};

/**
 * Decal fields, all optional except x/y/z/r:
 *   mat   material key (see DECO_MATERIALS in the engine)
 *   sx/sy/sz  scale on each axis, sz defaults to .55 (a flattened stud)
 *   tilt  rotation about Z, in radians
 */
const decal=(x,y,z,r,extra={})=>({x,y,z,r,...extra});

/**
 * Added on top of the reference. `IcosahedronGeometry` comes back non-indexed,
 * and the shell solver needs shared vertices — without merging, every triangle
 * would carry its own copy of each corner and deform independently, tearing the
 * surface apart.
 */
function mergeBall(geometry){
  const pos=geometry.attributes.position,map=new Map(),verts=[],indices=[];
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
    const key=Math.round(x*10000)+','+Math.round(y*10000)+','+Math.round(z*10000);
    let idx=map.get(key);
    if(idx===undefined){idx=verts.length/3;map.set(key,idx);verts.push(x,y,z)}
    indices.push(idx);
  }
  const out=new T.BufferGeometry();
  out.setAttribute('position',new T.Float32BufferAttribute(verts,3));
  out.setIndex(indices);
  return out;
}

export function makeShape(name){
  // Added on top of the reference: a plain glass ball. Its character is optical
  // rather than decorative — a very short attenuation distance so the gradient
  // pools at the bottom, plus iridescence for the rainbow rim. Two earlier
  // attempts (painted-on white highlights, a crystal suspended in the middle)
  // both read as foreign objects floating in the gel, so the ball stays empty.
  if(name==='orb'){
    const source=new T.IcosahedronGeometry(1.32,12);
    const merged=mergeBall(source);
    source.dispose();
    return finish(merged,[]);
  }

  if(name==='ghost'){
    // Uniform sphere triangles avoid the front/back poles of a flattened shell.
    const source=new T.IcosahedronGeometry(1,12),a=source.attributes.position;
    const vertices=[],indices=[],lookup=new Map();
    for(let i=0;i<a.count;i++){
      const x=a.getX(i),y=a.getY(i),z=a.getZ(i),angle=Math.atan2(z,x);
      const band=Math.exp(-(((y+.66)/.24)**2)),wave=.5+.5*Math.cos(angle*5+.4);
      const radius=1.23*(1+.42*band*wave);
      let height=y*1.23;if(height<-.4)height=-.4+(height+.4)*.62;
      height-=.12*band*wave;
      const point=[x*radius,height,z*radius],key=point.map(v=>Math.round(v*100000)).join(',');
      if(!lookup.has(key)){lookup.set(key,vertices.length/3);vertices.push(...point)}indices.push(lookup.get(key));
    }
    source.dispose();const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);
    return finish(geometry,[
      decal(-.4,.25,1.15,.15,{mat:'eye',sy:1.65}),
      decal(.39,.28,1.15,.15,{mat:'eye',sy:1.65}),
      decal(-.65,-.05,1.07,.13,{mat:'blush',sx:1.4}),
      decal(.65,-.02,1.07,.13,{mat:'blush',sx:1.4}),
      decal(-.42,.29,1.26,.029,{mat:'shine'}),
      decal(.37,.32,1.26,.029,{mat:'shine'}),
    ]);
  }
  const points=outlines[name].map(([x,y])=>new T.Vector3(x,y,0));
  let curve=new T.CatmullRomCurve3(points,true,'centripetal');
  if(name==='star'){
    // Broad cubic lobes follow the reference without pointed outer corners.
    const path=new T.Shape();path.moveTo(0,1.65);
    path.bezierCurveTo(-.28,1.65,-.46,1.08,-.58,.72);
    path.bezierCurveTo(-.98,.73,-1.58,.76,-1.64,.45);
    path.bezierCurveTo(-1.70,.18,-1.16,-.19,-.91,-.36);
    path.bezierCurveTo(-1.02,-.76,-1.19,-1.40,-.87,-1.43);
    path.bezierCurveTo(-.58,-1.46,-.21,-1.15,0,-1.02);
    path.bezierCurveTo(.21,-1.15,.58,-1.46,.87,-1.43);
    path.bezierCurveTo(1.19,-1.40,1.02,-.76,.91,-.36);
    path.bezierCurveTo(1.16,-.19,1.70,.18,1.64,.45);
    path.bezierCurveTo(1.58,.76,.98,.73,.58,.72);
    path.bezierCurveTo(.46,1.08,.28,1.65,0,1.65);
    path.closePath();curve=path;
  }
  // Thicker through the middle than the reference (a flat .48 everywhere) — a
  // star only .12 units deeper at the centre reads as a pressed-flat shape
  // rather than a piece of candy.
  if(name==='star')return finish(watermelonMesh(curve,(x,y)=>.42+.34*Math.exp(-(x*x+y*y)*.55),.44),[
    // The star gets a face too: it is the second character preset, and the
    // eyes are what make it read as a creature rather than a paper cut-out.
    decal(-.38,.42,.67,.122,{mat:'eye',sy:1.55}),
    decal(.38,.42,.67,.122,{mat:'eye',sy:1.55}),
    decal(-.335,.478,.745,.031,{mat:'shine'}),
    decal(.425,.478,.745,.031,{mat:'shine'}),
    // Sits close to the centre: past x≈.8 the shell has already curved away
    // and the stud sinks out of sight inside the gel.
    decal(-.64,.12,.665,.115,{mat:'blush',sx:1.35}),
    decal(.64,.12,.665,.115,{mat:'blush',sx:1.35}),
  ]);
  if(name==='watermelon'){
    const geometry=watermelonMesh(curve);
    const seed=(x,y,z,r,tilt)=>decal(x,y,z,r,{mat:'seed',sy:1.75,tilt});
    return finish(geometry,[
      seed(-.7,-.35,.59,.082,.35),
      seed(-.4,.24,.6,.088,.35),
      seed(.05,.72,.57,.08,-.45),
      seed(.5,.13,.61,.085,-.45),
      seed(.91,-.5,.56,.075,-.45),
      seed(.13,-.4,.64,.09,-.45),
      seed(-1.05,-.63,.56,.075,.35),
      seed(.4,-.82,.56,.082,-.45),
    ]);
  }
  if(name==='bear')return finish(watermelonMesh(curve,(x,y)=>{
    const bump=(cx,cy,wx,wy)=>Math.exp(-(((x-cx)/wx)**2)-((y-cy)/wy)**2);
    // Deeper contrast than the reference: a thinner core lets the head, belly
    // and paws read as separate volumes instead of one even slab.
    return .44+.40*bump(0,-.3,.70,.80)+.46*bump(0,1.00,.72,.62)+.26*(bump(-.60,-1.20,.34,.32)+bump(.60,-1.20,.34,.32));
  },.50),[
    // Added on top of the reference — the bear had no features at all, so it
    // read as a blank silhouette. Muzzle, mouth and a belly patch give it a
    // front and a back.
    decal(-.50,1.02,.72,.115,{mat:'eye',sy:1.6}),
    decal(.50,1.02,.72,.115,{mat:'eye',sy:1.6}),
    decal(-.455,1.075,.80,.033,{mat:'shine'}),
    decal(.545,1.075,.80,.033,{mat:'shine'}),
    decal(0,.72,.86,.105,{mat:'nose',sy:.82,sz:.62}),
    decal(-.10,.55,.80,.026,{mat:'nose'}),
    decal(0,.49,.815,.028,{mat:'nose'}),
    decal(.10,.55,.80,.026,{mat:'nose'}),
    decal(-.72,.68,.42,.12,{mat:'blush',sx:1.3}),
    decal(.72,.68,.42,.12,{mat:'blush',sx:1.3}),
    decal(0,-.22,.80,.26,{mat:'belly',sz:.2}),
  ]);
  // Flat on purpose. A domed face (the first attempt) makes the Delaunay
  // triangles disagree about their normals and you can read the whole mesh
  // across the front; a sugar cube has no curvature to hide behind.
  if(name==='cube')return finish(watermelonMesh(curve,()=>.64,.42),[
    // Frosted sugar grains, scattered so the eye reads "cast sugar" rather
    // than "blank glass block".
    decal(-.55,-.50,.61,.095,{mat:'frost',sz:.5}),
    decal(.45,.58,.61,.088,{mat:'frost',sz:.5}),
    decal(.72,-.18,.60,.075,{mat:'frost',sz:.5}),
    decal(-.30,.74,.60,.082,{mat:'frost',sz:.5}),
    decal(.05,-.76,.59,.090,{mat:'frost',sz:.5}),
    decal(-.80,.22,.57,.070,{mat:'frost',sz:.5}),
    decal(.62,.10,.61,.066,{mat:'frost',sz:.5}),
    decal(-.12,-.06,.61,.058,{mat:'frost',sz:.5}),
  ]);
}
function finish(geometry,face){
  const a=geometry.attributes.position;let bottom=Infinity;
  for(let i=0;i<a.count;i++)bottom=Math.min(bottom,a.getY(i));
  for(let i=0;i<a.count;i++)a.setY(i,a.getY(i)-bottom+.035);
  geometry.computeVertexNormals();
  const shift=y=>y-bottom+.035;
  return {geometry,face:face.map(f=>Array.isArray(f)
    ?{x:f[0],y:shift(f[1]),z:f[2],r:f[3],mat:'ink'}
    :{...f,y:shift(f.y)})};
}

// Evenly spaced face vertices, Delaunay triangles and a rounded perimeter.
// Unlike the character shells, the watermelon has no front/back pole or fan.
function watermelonMesh(curve,depthAt=()=>.6,edgeWidth=.24){
  const border=Array.from({length:112},(_,i)=>{const p=curve.getPoint(i/112);return [p.x,p.y]});
  function inside(x,y){let result=false;for(let i=0,j=border.length-1;i<border.length;j=i++){const a=border[i],b=border[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])result=!result}return result}
  function distance(x,y){let nearest=Infinity;for(let i=0;i<border.length;i++){const a=border[i],b=border[(i+1)%border.length],dx=b[0]-a[0],dy=b[1]-a[1],t=T.MathUtils.clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy),0,1);nearest=Math.min(nearest,Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy))}return nearest}
  const points=[...border];let row=0;
  for(let y=Math.min(...border.map(p=>p[1]));y<Math.max(...border.map(p=>p[1]));y+=.085,row++)for(let x=Math.min(...border.map(p=>p[0]))+(row%2)*.0425;x<Math.max(...border.map(p=>p[0]));x+=.085)if(inside(x,y)&&distance(x,y)>.045)points.push([x,y]);
  const count=points.length;points.push([-30,-30],[30,-30],[0,30]);
  function triangle(a,b,c){const [ax,ay]=points[a],[bx,by]=points[b],[cx,cy]=points[c],d=2*(ax*(by-cy)+bx*(cy-ay)+cx*(ay-by));if(Math.abs(d)<1e-10)return null;const aa=ax*ax+ay*ay,bb=bx*bx+by*by,cc=cx*cx+cy*cy,x=(aa*(by-cy)+bb*(cy-ay)+cc*(ay-by))/d,y=(aa*(cx-bx)+bb*(ax-cx)+cc*(bx-ax))/d;return {a,b,c,x,y,r:(x-ax)**2+(y-ay)**2}}
  let triangles=[triangle(count,count+1,count+2)];
  for(let i=0;i<count;i++){
    const [x,y]=points[i],edges=new Map(),keep=[];
    for(const t of triangles){if((x-t.x)**2+(y-t.y)**2<t.r+1e-9){for(const [a,b] of [[t.a,t.b],[t.b,t.c],[t.c,t.a]]){const key=a<b?`${a},${b}`:`${b},${a}`;if(edges.has(key))edges.delete(key);else edges.set(key,[a,b])}}else keep.push(t)}
    for(const [a,b] of edges.values()){const t=triangle(a,b,i);if(t)keep.push(t)}triangles=keep;
  }
  const vertices=[],indices=[];
  for(const side of [1,-1])for(let i=0;i<count;i++){const [x,y]=points[i],d=i<border.length?0:distance(x,y),edge=Math.min(1,d/edgeWidth),z=depthAt(x,y,side)*Math.sqrt(1-(1-edge)**2);vertices.push(x,y,side*z)}
  for(const t of triangles){let {a,b,c}=t;if(a>=count||b>=count||c>=count)continue;const p=points[a],q=points[b],r=points[c];if(!inside((p[0]+q[0]+r[0])/3,(p[1]+q[1]+r[1])/3))continue;if((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])<0)[b,c]=[c,b];indices.push(a,b,c,a+count,c+count,b+count)}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);return geometry;
}
