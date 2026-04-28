'use client';

interface Step2ATutoringSubjectsProps {
  subjects: string[];
  onUpdate: (subjects: string[]) => void;
}

const SUBJECT_OPTIONS = [
  'Math',
  'English',
  'Science',
  'History',
  'Languages',
];

export default function Step2ATutoringSubjects({
  subjects,
  onUpdate,
}: Step2ATutoringSubjectsProps) {
  const handleToggle = (subject: string) => {
    if (subjects.includes(subject)) {
      onUpdate(subjects.filter(s => s !== subject));
    } else {
      onUpdate([...subjects, subject]);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">What subjects do you tutor?</h2>
        <p className="mt-2 text-sm text-gray-600">
          Select all subjects you're comfortable tutoring.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SUBJECT_OPTIONS.map((subject) => (
          <label
            key={subject}
            className="relative flex items-center p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center h-5">
              <input
                type="checkbox"
                checked={subjects.includes(subject)}
                onChange={() => handleToggle(subject)}
                className="h-5 w-5 text-[#0088CB] focus:ring-[#0088CB] border-gray-300 rounded"
              />
            </div>
            <span className="ml-3 text-base font-medium text-gray-900">{subject}</span>
            {subjects.includes(subject) && (
              <div className="absolute top-2 right-2">
                <svg className="h-5 w-5 text-[#0088CB]" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
          </label>
        ))}
      </div>

      {subjects.length === 0 && (
        <p className="text-sm text-red-600 mt-2">
          Please select at least one subject to continue.
        </p>
      )}
    </div>
  );
}


