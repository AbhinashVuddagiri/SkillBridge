import React, { useState } from 'react';
import {
  Layers,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Plus,
  Trash2,
  BookOpen,
  Calendar,
  Award
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import confetti from 'canvas-confetti';

export default function OnboardingPage({ setCurrentView }) {
  const { user, saveOnboarding } = useAuth();

  const [step, setStep] = useState(1);
  const [bio, setBio] = useState(user?.bio || '');
  const [college, setCollege] = useState(user?.college || '');
  const [educationLevel, setEducationLevel] = useState(user?.educationLevel || 'Undergraduate Senior');
  const [location, setLocation] = useState(user?.location || 'San Francisco, CA');
  const [careerGoal, setCareerGoal] = useState(user?.careerGoal || 'Full Stack Product Engineer');
  const [preference, setPreference] = useState(user?.preference || 'Online');

  // Skills to teach
  const [skillsTeach, setSkillsTeach] = useState(
    user?.skillsTeach?.length
      ? user.skillsTeach
      : [{ name: 'Python', category: 'Programming and Web Development', proficiency: 'Advanced', yearsExp: 3 }]
  );
  const [teachName, setTeachName] = useState('');
  const [teachCategory, setTeachCategory] = useState('Programming and Web Development');
  const [teachProficiency, setTeachProficiency] = useState('Intermediate');

  // Skills to learn
  const [skillsLearn, setSkillsLearn] = useState(
    user?.skillsLearn?.length
      ? user.skillsLearn
      : [{ name: 'UI/UX Design', category: 'UI/UX and Graphic Design', goal: 'Build modern glassmorphism apps' }]
  );
  const [learnName, setLearnName] = useState('');
  const [learnCategory, setLearnCategory] = useState('UI/UX and Graphic Design');
  const [learnGoal, setLearnGoal] = useState('');

  // Availability
  const [availability, setAvailability] = useState(
    user?.availability?.length ? user.availability : ['Tuesday Evenings', 'Weekends']
  );
  const [availSlot, setAvailSlot] = useState('');

  const [saving, setSaving] = useState(false);

  const handleAddTeach = () => {
    if (!teachName.trim()) return;
    setSkillsTeach([
      ...skillsTeach,
      { name: teachName.trim(), category: teachCategory, proficiency: teachProficiency, yearsExp: 2 }
    ]);
    setTeachName('');
  };

  const handleRemoveTeach = (idx) => {
    setSkillsTeach(skillsTeach.filter((_, i) => i !== idx));
  };

  const handleAddLearn = () => {
    if (!learnName.trim()) return;
    setSkillsLearn([
      ...skillsLearn,
      { name: learnName.trim(), category: learnCategory, goal: learnGoal.trim() }
    ]);
    setLearnName('');
    setLearnGoal('');
  };

  const handleRemoveLearn = (idx) => {
    setSkillsLearn(skillsLearn.filter((_, i) => i !== idx));
  };

  const handleAddAvail = () => {
    if (!availSlot.trim()) return;
    setAvailability([...availability, availSlot.trim()]);
    setAvailSlot('');
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await saveOnboarding({
        bio,
        college,
        educationLevel,
        location,
        careerGoal,
        preference,
        skillsTeach,
        skillsLearn,
        availability
      });

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      setStep(5);
    } catch (err) {
      alert(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      {/* Step Indicator */}
      <div className="bg-white rounded-2xl p-4 flex items-center justify-between border border-[#D5E9DF] shadow-xs">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s
                  ? 'bg-[#16866A] text-white shadow-xs'
                  : step > s
                  ? 'bg-[#E4F6EE] text-[#16866A] border border-[#D5E9DF]'
                  : 'bg-[#F1FAF5] text-[#527568]'
              }`}
            >
              {step > s ? '✓' : s}
            </div>
            <span className="text-xs font-semibold text-[#164E41] hidden sm:inline">
              {s === 1 ? 'Profile' : s === 2 ? 'Teach' : s === 3 ? 'Learn' : 'Schedule'}
            </span>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-[#D5E9DF] shadow-xs space-y-6">
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-extrabold text-[#164E41]">Student Profile & Education</h2>
              <p className="text-xs text-[#527568] mt-1">
                Tell potential peer partners about your background and career ambition.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#164E41] mb-1">
                  College / Institution
                </label>
                <input
                  type="text"
                  placeholder="e.g. Stanford, Georgia Tech, Self-Taught"
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] placeholder-[#527568]/60 text-xs focus:outline-none focus:border-[#16866A] focus:ring-1 focus:ring-[#16866A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#164E41] mb-1">
                    Education Level
                  </label>
                  <select
                    value={educationLevel}
                    onChange={(e) => setEducationLevel(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] text-xs focus:outline-none focus:border-[#16866A]"
                  >
                    <option value="Undergraduate">Undergraduate</option>
                    <option value="Undergraduate Senior">Undergraduate Senior</option>
                    <option value="Graduate Student">Graduate Student</option>
                    <option value="Self-Taught / Independent">Self-Taught / Independent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#164E41] mb-1">
                    Career Target Track
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Full Stack Product Engineer"
                    value={careerGoal}
                    onChange={(e) => setCareerGoal(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] placeholder-[#527568]/60 text-xs focus:outline-none focus:border-[#16866A] focus:ring-1 focus:ring-[#16866A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#164E41] mb-1">
                  Short Introduction / Bio
                </label>
                <textarea
                  rows={3}
                  placeholder="Share a bit about what motivates you and what projects you love..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] placeholder-[#527568]/60 text-xs focus:outline-none focus:border-[#16866A] focus:ring-1 focus:ring-[#16866A]"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-[#16866A] hover:bg-[#0F7058] shadow-md shadow-[#16866A]/20 flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <span>Continue: Skills You Teach</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-extrabold text-[#164E41]">Skills You Can Teach</h2>
              <p className="text-xs text-[#527568] mt-1">
                Your skills are your currency. Add anything you feel confident teaching to peers.
              </p>
            </div>

            {/* List */}
            <div className="space-y-2">
              {skillsTeach.map((st, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-[#F1FAF5] border border-[#D5E9DF] flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-xs font-bold text-[#164E41]">{st.name}</h4>
                    <span className="text-[10px] text-[#527568]">
                      {st.category} • {st.proficiency}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveTeach(i)}
                    className="p-1 text-[#527568] hover:text-rose-500 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add New Teach */}
            <div className="p-4 rounded-2xl bg-[#F1FAF5] border border-[#D5E9DF] space-y-3">
              <span className="text-xs font-bold text-[#164E41] block">Add Skill to Teach:</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Skill name (e.g. Python)"
                  value={teachName}
                  onChange={(e) => setTeachName(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] placeholder-[#527568]/60 text-xs focus:outline-none focus:border-[#16866A]"
                />
                <select
                  value={teachCategory}
                  onChange={(e) => setTeachCategory(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] text-xs focus:outline-none focus:border-[#16866A]"
                >
                  <option value="Programming and Web Development">Programming & Web</option>
                  <option value="UI/UX and Graphic Design">UI/UX & Design</option>
                  <option value="AI and Machine Learning">AI & Machine Learning</option>
                  <option value="Languages and Communication">Languages & Communication</option>
                  <option value="Photography and Video Editing">Video Editing</option>
                </select>
                <select
                  value={teachProficiency}
                  onChange={(e) => setTeachProficiency(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] text-xs focus:outline-none focus:border-[#16866A]"
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                  <option value="Expert">Expert</option>
                </select>
              </div>
              <button
                type="button"
                onClick={handleAddTeach}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#E4F6EE] text-[#16866A] border border-[#D5E9DF] hover:bg-[#A8E6CF]/30 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Skill</span>
              </button>
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#527568] hover:text-[#164E41] cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-[#16866A] hover:bg-[#0F7058] shadow-md shadow-[#16866A]/20 flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <span>Continue: Skills You Want to Learn</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-extrabold text-[#164E41]">Skills You Want to Learn</h2>
              <p className="text-xs text-[#527568] mt-1">
                What skills do you want to pick up from peer mentors?
              </p>
            </div>

            {/* List */}
            <div className="space-y-2">
              {skillsLearn.map((sl, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-[#F1FAF5] border border-[#D5E9DF] flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-xs font-bold text-[#16866A]">{sl.name}</h4>
                    <span className="text-[10px] text-[#527568]">{sl.category}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveLearn(i)}
                    className="p-1 text-[#527568] hover:text-rose-500 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add New Learn */}
            <div className="p-4 rounded-2xl bg-[#F1FAF5] border border-[#D5E9DF] space-y-3">
              <span className="text-xs font-bold text-[#164E41] block">Add Skill to Learn:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Skill name (e.g. Figma UI Design)"
                  value={learnName}
                  onChange={(e) => setLearnName(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] placeholder-[#527568]/60 text-xs focus:outline-none focus:border-[#16866A]"
                />
                <select
                  value={learnCategory}
                  onChange={(e) => setLearnCategory(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] text-xs focus:outline-none focus:border-[#16866A]"
                >
                  <option value="UI/UX and Graphic Design">UI/UX & Design</option>
                  <option value="Programming and Web Development">Programming & Web</option>
                  <option value="AI and Machine Learning">AI & Machine Learning</option>
                  <option value="Languages and Communication">Languages & Communication</option>
                  <option value="Photography and Video Editing">Video Editing</option>
                </select>
              </div>
              <input
                type="text"
                placeholder="Personal goal (e.g. Build interactive prototypes for portfolio)"
                value={learnGoal}
                onChange={(e) => setLearnGoal(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] placeholder-[#527568]/60 text-xs focus:outline-none focus:border-[#16866A]"
              />
              <button
                type="button"
                onClick={handleAddLearn}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#E4F6EE] text-[#16866A] border border-[#D5E9DF] hover:bg-[#A8E6CF]/30 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Goal</span>
              </button>
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#527568] hover:text-[#164E41] cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-[#16866A] hover:bg-[#0F7058] shadow-md shadow-[#16866A]/20 flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <span>Continue: Availability & Schedule</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-extrabold text-[#164E41]">Availability & Learning Format</h2>
              <p className="text-xs text-[#527568] mt-1">
                Help match algorithms pair you with peers in compatible time windows.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#164E41] mb-1">
                  Format Preference
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {['Online', 'In-Person'].map((f) => (
                    <button
                      type="button"
                      key={f}
                      onClick={() => setPreference(f)}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        preference === f
                          ? 'bg-[#E4F6EE] border-[#16866A] text-[#16866A] shadow-xs'
                          : 'bg-[#F1FAF5] border-[#D5E9DF] text-[#527568]'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#164E41] mb-1">
                  Available Time Slots
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {availability.map((av, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg bg-[#F1FAF5] border border-[#D5E9DF] text-xs text-[#164E41] flex items-center gap-1.5"
                    >
                      <span>{av}</span>
                      <button
                        onClick={() => setAvailability(availability.filter((_, idx) => idx !== i))}
                        className="text-[#527568] hover:text-rose-500 cursor-pointer font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Tuesday Evenings 7:00 PM EST"
                    value={availSlot}
                    onChange={(e) => setAvailSlot(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] placeholder-[#527568]/60 text-xs focus:outline-none focus:border-[#16866A]"
                  />
                  <button
                    type="button"
                    onClick={handleAddAvail}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#16866A] hover:bg-[#0F7058] text-white cursor-pointer transition-all"
                  >
                    Add Slot
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#527568] hover:text-[#164E41] cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleFinish}
                className="px-7 py-3 rounded-xl text-xs font-bold text-white bg-[#16866A] hover:bg-[#0F7058] shadow-md shadow-[#16866A]/20 flex items-center gap-2 cursor-pointer transition-all"
              >
                {saving ? (
                  <span>Saving Profile...</span>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Complete Onboarding & Unlock Badge</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#E4F6EE] border border-[#A8E6CF] text-[#16866A] mx-auto flex items-center justify-center">
              <CheckCircle className="w-10 h-10 animate-bounce" />
            </div>
            <h2 className="text-2xl font-extrabold text-[#164E41]">Profile Configured! 🎓</h2>
            <p className="text-xs text-[#527568] max-w-md mx-auto leading-relaxed">
              You’ve unlocked the <strong className="text-[#164E41]">'Ready to Exchange'</strong> badge and +150 XP. Your profile is now visible to peers and ready for smart matching!
            </p>
            <div className="pt-4 flex justify-center gap-3">
              <button
                onClick={() => setCurrentView('dashboard')}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-[#16866A] hover:bg-[#0F7058] shadow-md shadow-[#16866A]/20 cursor-pointer transition-all"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => setCurrentView('explore')}
                className="px-6 py-2.5 rounded-xl text-xs font-semibold text-[#164E41] bg-[#F1FAF5] border border-[#D5E9DF] hover:bg-[#E4F6EE] cursor-pointer transition-colors"
              >
                Find Skill Partners
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
