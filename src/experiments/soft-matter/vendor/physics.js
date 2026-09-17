import {Vector3,Quaternion} from 'three';
const r=new Vector3(),f=new Vector3(),v=new Vector3(),torque=new Vector3(),axis=new Vector3(),spin=new Quaternion();
// Unit mass rigid motion with point-grab torque; a separate soft shell deforms.
export class SoftBodyMotion {
  constructor(){this.center=new Vector3();this.support=[new Vector3()];this.inertia=new Vector3(1,1,1);this.reset()}
  reset(){this.position=[0,0,0];this.velocity=[0,0,0];this.rotation=new Quaternion();this.angularVelocity=new Vector3();this.squash=0;this.squashVelocity=0;this.lastImpact=0;this.lowest=0}
  setShape(vertices){
    const min=new Vector3(Infinity,Infinity,Infinity),max=new Vector3(-Infinity,-Infinity,-Infinity);
    for(let i=0;i<vertices.length;i+=3){r.fromArray(vertices,i);min.min(r);max.max(r)}
    this.center.copy(min).add(max).multiplyScalar(.5);
    const size=max.sub(min);
    this.inertia.set((size.y**2+size.z**2)/12,(size.x**2+size.z**2)/12,(size.x**2+size.y**2)/12);
    this.support=[];const stride=Math.max(1,Math.floor(vertices.length/3/250));
    for(let i=0;i<vertices.length/3;i+=stride)this.support.push(new Vector3().fromArray(vertices,i*3).sub(this.center));
  }
  drop(height=3){this.reset();this.position[1]=height}
  step(dt,{elasticity=50,damping=35,grab=null}={}){
    const k=45+elasticity*.75;
    f.set(0,0,0);
    if(grab){
      if(Array.isArray(grab)){r.set(0,0,0);f.fromArray(grab).sub(new Vector3().fromArray(this.position))}
      else{r.fromArray(grab.local).sub(this.center).applyQuaternion(this.rotation);f.fromArray(grab.target).sub(this.center).sub(r).sub(new Vector3().fromArray(this.position))}
      v.copy(this.angularVelocity).cross(r).add(new Vector3().fromArray(this.velocity));
      f.multiplyScalar(k).addScaledVector(v,-2*Math.sqrt(k)*.65).clampLength(0,180);
      torque.copy(r).cross(f);this.applyTorque(torque,dt);
    }
    for(let c=0;c<3;c++){this.velocity[c]+=(f.getComponent(c)-(c===1?9.81:0))*dt;this.position[c]+=this.velocity[c]*dt}
    this.angularVelocity.multiplyScalar(Math.exp(-(.35+damping*.012)*dt)).clampLength(0,12);
    const speed=this.angularVelocity.length();if(speed>1e-6){axis.copy(this.angularVelocity).divideScalar(speed);spin.setFromAxisAngle(axis,speed*dt);this.rotation.premultiply(spin).normalize()}
    this.lastImpact=0;
    let contact=false;
    for(let iteration=0;iteration<4;iteration++){
      let lowest=Infinity,index=0;
      for(let i=0;i<this.support.length;i++){r.copy(this.support[i]).applyQuaternion(this.rotation);const y=this.position[1]+this.center.y+r.y;if(y<lowest){lowest=y;index=i}}
      this.lowest=Math.max(0,lowest);
      if(lowest>.005)break;
      contact=true;this.position[1]-=Math.min(0,lowest);
      r.copy(this.support[index]).applyQuaternion(this.rotation);
      v.copy(this.angularVelocity).cross(r).add(new Vector3().fromArray(this.velocity));
      if(v.y<0){
        const impact=-v.y;this.lastImpact=Math.max(this.lastImpact,impact);
        const restitution=impact<.6?0:Math.min(.72,(.30+elasticity*.006)*(1-damping*.002));
        torque.set(-r.z,0,r.x).applyQuaternion(this.rotation.clone().invert()).divide(this.inertia).applyQuaternion(this.rotation);
        const denom=1+torque.z*r.x-torque.x*r.z;
        const impulse=-(1+restitution)*v.y/denom;this.velocity[1]+=impulse;
        torque.set(-r.z*impulse,0,r.x*impulse);this.applyTorque(torque,1);
        const friction=Math.min(.6*impulse,Math.hypot(v.x,v.z));
        const tangent=Math.hypot(v.x,v.z);if(tangent>1e-5){f.set(-v.x/tangent*friction,0,-v.z/tangent*friction);this.velocity[0]+=f.x;this.velocity[2]+=f.z;torque.copy(r).cross(f);this.applyTorque(torque,.4)}
      }
    }
    if(contact){this.angularVelocity.multiplyScalar(Math.exp(-3*dt));this.velocity[0]*=Math.exp(-2*dt);this.velocity[2]*=Math.exp(-2*dt)}
    if(this.lastImpact>.4)this.squashVelocity+=Math.min(this.lastImpact*.65,5);
    this.squashVelocity+=(-100*this.squash-(5+damping*.12)*this.squashVelocity)*dt;
    this.squash+=this.squashVelocity*dt;
    this.squash=Math.max(-.16,Math.min(.36,this.squash));
  }
  applyTorque(value,dt){torque.copy(value).applyQuaternion(this.rotation.clone().invert()).divide(this.inertia).applyQuaternion(this.rotation);this.angularVelocity.addScaledVector(torque,dt)}
}
