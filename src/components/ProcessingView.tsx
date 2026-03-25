import type { ProcessingStep } from '../services/types'

interface ProcessingViewProps {
  imageUrl: string
  steps: ProcessingStep[]
}

export default function ProcessingView({ imageUrl, steps }: ProcessingViewProps) {
  return (
    <div className="processing-view">
      <div className="processing-left">
        <div className="processing-image-container">
          <img src={imageUrl} alt="Floor plan" className="processing-image" />
          <div className="scan-line" />
        </div>
      </div>
      <div className="processing-right">
        <h3 className="processing-title">Analyzing floor plan...</h3>
        <div className="processing-steps">
          {steps.map((step, i) => (
            <div key={i} className="processing-step">
              <div className={`step-dot step-${step.status}`}>
                {step.status === 'done' ? '✓' : step.status === 'active' ? '⋯' : i + 1}
              </div>
              <div className="step-text">
                <strong>{step.label}</strong>
                {step.detail && <br />}
                {step.detail && <span>{step.detail}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
