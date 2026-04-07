import React, { useMemo, useState } from 'react';
import { ArrowDown, ChevronDown, ChevronUp } from 'lucide-react';

export type VisualExplanation = {
  type: 'visual_explanation';
  title: string;
  sections: Array<{ label: string; title: string; content: string }>;
  bullets: string[];
};

type Props = {
  model: VisualExplanation;
  isDisabled?: boolean;
  onAction?: (actionId: VisualExplanationAction, args?: { sectionIndex?: number }) => void;
};

export type VisualExplanationAction =
  | 'expand'
  | 'regenerate_visual'
  | 'simplify'
  | 'more_detailed'
  | 'explain_this_part'
  | 'turn_into_quiz'
  | 'save_to_study_mode'
  | 'add_to_planner';

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export default function VisualExplanationCard(props: Props) {
  const { model, isDisabled, onAction } = props;
  const [isExpanded, setIsExpanded] = useState(false);
  const [sectionIndex, setSectionIndex] = useState<number>(0);

  const safeSections = Array.isArray(model.sections) ? model.sections : [];
  const safeBullets = Array.isArray(model.bullets) ? model.bullets : [];

  const visibleSections = useMemo(() => {
    if (isExpanded) return safeSections;
    return safeSections.slice(0, 4);
  }, [isExpanded, safeSections]);

  const hasHiddenSections = safeSections.length > visibleSections.length;

  return (
    <div className="visual-explain">
      <div className="visual-explain__card" aria-label="Visual explanation">
        <div className="visual-explain__header">
          <div className="visual-explain__title">{model.title || 'Visual explanation'}</div>
        </div>

        <div className="visual-explain__sections" aria-label="Sections">
          {visibleSections.map((s, idx) => (
            <React.Fragment key={`${s.label}_${s.title}_${idx}`}>
              <div className="visual-explain__section">
                <div className="visual-explain__section-top">
                  <span className="visual-explain__section-label">{(s.label || 'SECTION').toUpperCase()}</span>
                  <div className="visual-explain__section-title">{s.title}</div>
                </div>
                <div className="visual-explain__section-content">{s.content}</div>
              </div>
              {idx < visibleSections.length - 1 ? (
                <div className="visual-explain__divider" aria-hidden="true">
                  <ArrowDown className="visual-explain__divider-icon" />
                </div>
              ) : null}
            </React.Fragment>
          ))}
        </div>

        {safeBullets.length ? (
          <div className="visual-explain__bullets" aria-label="Key takeaways">
            <div className="visual-explain__bullets-title">Key takeaways</div>
            <ul className="visual-explain__bullets-list">
              {safeBullets.map((b, idx) => (
                <li key={`${idx}_${b}`} className="visual-explain__bullet">
                  {b}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="visual-explain__actions" aria-label="Visual explanation actions">
        <div className="visual-explain__actions-row">
          <button
            type="button"
            className="visual-explain__action"
            disabled={Boolean(isDisabled)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setIsExpanded((v) => !v);
              onAction?.('expand');
            }}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="visual-explain__action-icon" aria-hidden="true" />
                <span>Collapse</span>
              </>
            ) : (
              <>
                <ChevronDown className="visual-explain__action-icon" aria-hidden="true" />
                <span>{hasHiddenSections ? 'Expand' : 'Expand'}</span>
              </>
            )}
          </button>
          <button
            type="button"
            className="visual-explain__action"
            disabled={Boolean(isDisabled)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onAction?.('regenerate_visual')}
          >
            Regenerate visual
          </button>
          <button
            type="button"
            className="visual-explain__action"
            disabled={Boolean(isDisabled)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onAction?.('simplify')}
          >
            Simplify
          </button>
          <button
            type="button"
            className="visual-explain__action"
            disabled={Boolean(isDisabled)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onAction?.('more_detailed')}
          >
            More detailed
          </button>
        </div>

        <div className="visual-explain__actions-row">
          <div className="visual-explain__select">
            <label className="visual-explain__select-label" htmlFor="visual-explain-part">
              Explain this part
            </label>
            <select
              id="visual-explain-part"
              className={classNames('visual-explain__select-control', safeSections.length ? '' : 'is-empty')}
              disabled={Boolean(isDisabled) || safeSections.length === 0}
              value={sectionIndex}
              onChange={(e) => setSectionIndex(Number(e.target.value))}
            >
              {safeSections.length === 0 ? <option value={0}>No sections</option> : null}
              {safeSections.map((s, idx) => (
                <option key={`${idx}_${s.title}`} value={idx}>
                  {s.label ? `${s.label}: ` : ''}
                  {s.title || `Section ${idx + 1}`}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="visual-explain__action"
              disabled={Boolean(isDisabled) || safeSections.length === 0}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onAction?.('explain_this_part', { sectionIndex })}
            >
              Explain
            </button>
          </div>

          <button
            type="button"
            className="visual-explain__action"
            disabled={Boolean(isDisabled)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onAction?.('turn_into_quiz')}
          >
            Turn into quiz
          </button>
          <button
            type="button"
            className="visual-explain__action"
            disabled={Boolean(isDisabled)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onAction?.('save_to_study_mode')}
          >
            Save to study mode
          </button>
          <button
            type="button"
            className="visual-explain__action"
            disabled={Boolean(isDisabled)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onAction?.('add_to_planner')}
          >
            Add to planner
          </button>
        </div>
      </div>
    </div>
  );
}

