import React, { useEffect, useState } from 'react';
import {
  Users,
  MessageCircle,
  Calendar,
  Sparkles,
  Plus,
  CheckCircle,
  Tag,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export default function CommunityRoomsPage({ setCurrentView }) {
  const { user, openAuth } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Programming and Web Development');
  const [description, setDescription] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [tags, setTags] = useState('');

  const fetchRooms = async () => {
    try {
      const res = await api.getCommunityRooms();
      setRooms(res.rooms || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleToggleJoin = async (roomId) => {
    if (!user) {
      openAuth('login');
      return;
    }
    try {
      await api.joinRoom(roomId);
      await fetchRooms();
    } catch (err) {
      alert(err.message || 'Failed to update membership');
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!user) {
      openAuth('login');
      return;
    }

    try {
      await api.createRoom({
        title,
        category,
        description,
        meetingTime,
        tags
      });
      setShowCreateModal(false);
      setTitle('');
      setDescription('');
      setMeetingTime('');
      setTags('');
      await fetchRooms();
    } catch (err) {
      alert(err.message || 'Failed to create room');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E4F6EE] text-[#16866A] border border-[#D5E9DF] text-xs font-bold">
            <Users className="w-4 h-4 text-[#16866A]" />
            <span>Collaborative Cohorts</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#164E41] tracking-tight">
            Community Study Rooms
          </h1>
          <p className="text-xs sm:text-sm text-[#527568] max-w-2xl leading-relaxed">
            Join small student-led study circles for code reviews, Figma critiques, conversational language drills, and hackathon pairings.
          </p>
        </div>

        <button
          onClick={() => (user ? setShowCreateModal(true) : openAuth('login'))}
          className="px-5 py-3 rounded-2xl text-xs font-bold text-white bg-[#16866A] hover:bg-[#0F7058] shadow-md shadow-[#16866A]/20 flex items-center gap-2 shrink-0 cursor-pointer transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Create Study Room</span>
        </button>
      </div>

      {/* Rooms Grid */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="w-10 h-10 border-2 border-[#16866A] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-[#527568]">Loading community study rooms...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="bg-white rounded-3xl p-6 sm:p-7 space-y-5 flex flex-col justify-between border border-[#D5E9DF] shadow-xs"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-bold text-[#16866A] px-2.5 py-1 rounded-full bg-[#E4F6EE] border border-[#D5E9DF]">
                    {room.category}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-[#527568] font-semibold">
                    <Users className="w-3.5 h-3.5 text-[#16866A]" />
                    <span>{room.membersCount || room.members?.length || 1} members</span>
                  </span>
                </div>

                <h3 className="text-lg font-bold text-[#164E41]">{room.title}</h3>
                <p className="text-xs text-[#527568] leading-relaxed">{room.description}</p>

                {/* Meeting time */}
                <div className="flex items-center gap-2 text-xs text-[#527568]">
                  <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Weekly Sessions: {room.meetingTime}</span>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(room.tags || []).map((t, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-lg bg-[#F1FAF5] border border-[#D5E9DF] text-[10px] text-[#527568] font-medium"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-[#D5E9DF] flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-xs text-[#527568]">
                  <MessageCircle className="w-3.5 h-3.5 text-[#16866A]" />
                  <span>{room.activeDiscussions || 12} shared discussions</span>
                </div>

                <button
                  onClick={() => handleToggleJoin(room.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    room.isJoined
                      ? 'bg-[#E4F6EE] text-[#16866A] border border-[#D5E9DF] hover:bg-[#E4F6EE]/80'
                      : 'bg-[#16866A] hover:bg-[#0F7058] text-white shadow-md shadow-[#16866A]/20'
                  }`}
                >
                  {room.isJoined ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Joined • Active</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Join Room</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#164E41]/40 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#D5E9DF]">
            <h3 className="text-xl font-bold text-[#164E41] mb-4">Create New Study Room</h3>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#164E41] mb-1">
                  Room Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Next.js App Router & Server Actions Collective"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] placeholder-[#527568]/60 text-xs focus:outline-none focus:border-[#16866A] focus:ring-1 focus:ring-[#16866A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#164E41] mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] text-xs focus:outline-none focus:border-[#16866A]"
                >
                  <option value="Programming and Web Development">Programming and Web Development</option>
                  <option value="UI/UX and Graphic Design">UI/UX and Graphic Design</option>
                  <option value="AI and Machine Learning">AI and Machine Learning</option>
                  <option value="Languages and Communication">Languages and Communication</option>
                  <option value="Academic Tutoring">Academic Tutoring</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#164E41] mb-1">
                  Description & Goals
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="What will group members learn and build together?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] placeholder-[#527568]/60 text-xs focus:outline-none focus:border-[#16866A] focus:ring-1 focus:ring-[#16866A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#164E41] mb-1">
                    Meeting Schedule
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Thursdays 7:00 PM EST"
                    value={meetingTime}
                    onChange={(e) => setMeetingTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] placeholder-[#527568]/60 text-xs focus:outline-none focus:border-[#16866A] focus:ring-1 focus:ring-[#16866A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#164E41] mb-1">Tags</label>
                  <input
                    type="text"
                    placeholder="e.g. React, TypeScript, APIs"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] placeholder-[#527568]/60 text-xs focus:outline-none focus:border-[#16866A] focus:ring-1 focus:ring-[#16866A]"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-[#527568] hover:bg-[#F1FAF5] hover:text-[#164E41] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-[#16866A] hover:bg-[#0F7058] shadow-md shadow-[#16866A]/20 cursor-pointer"
                >
                  Publish Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
