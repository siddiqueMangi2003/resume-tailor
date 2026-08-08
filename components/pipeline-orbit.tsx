import { BriefcaseBusiness, FileCheck2, MessagesSquare } from "lucide-react"

export function PipelineOrbit() {
  return (
    <div className="pipeline-scene" aria-hidden="true">
      <div className="pipeline-glow" />
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="orbit orbit-three" />
      <div className="pipeline-core">
        <span className="pipeline-core-label">Career OS</span>
        <strong>Move with clarity</strong>
      </div>
      <div className="floating-card card-one">
        <BriefcaseBusiness className="h-5 w-5" />
        <span>Saved</span>
        <strong>12 roles</strong>
      </div>
      <div className="floating-card card-two">
        <MessagesSquare className="h-5 w-5" />
        <span>Interview</span>
        <strong>Thursday</strong>
      </div>
      <div className="floating-card card-three">
        <FileCheck2 className="h-5 w-5" />
        <span>Tailored</span>
        <strong>ATS ready</strong>
      </div>
    </div>
  )
}
