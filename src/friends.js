import { state } from './state.js';
import { supabase } from './supabase.js';
import { setView, toast } from './ui.js';

export async function renderFriends() {
  const myId = state.profile.id;
  const siblings = state.profiles.filter(p => p.id !== myId);

  const [{ data: accepted }, { data: pending }] = await Promise.all([
    supabase.from('friendships')
      .select('*, friend:requester_id(id,username,avatar_emoji), friend2:addressee_id(id,username,avatar_emoji)')
      .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`)
      .eq('status', 'accepted'),
    supabase.from('friendships')
      .select('*, requester:requester_id(username, avatar_emoji)')
      .eq('addressee_id', myId)
      .eq('status', 'pending'),
  ]);

  const siblingsHtml = siblings.length
    ? `<div class="siblings-section">
        <h3>👨‍👩‍👧 Sisters</h3>
        <div class="friend-list">
          ${siblings.map(s => `
            <div class="friend-row">
              <span class="friend-av">${s.avatar_emoji}</span>
              <span class="friend-name">${s.username}</span>
              <a href="#collection/${s.id}" class="btn btn-outline btn-sm">See Collection</a>
            </div>
          `).join('')}
        </div>
      </div>`
    : '';

  const friendList = (accepted || []).map(f => {
    const friend = f.friend.id === myId ? f.friend2 : f.friend;
    return `
      <div class="friend-row">
        <span class="friend-av">${friend.avatar_emoji}</span>
        <span class="friend-name">${friend.username}</span>
        <a href="#collection/${friend.id}" class="btn btn-outline btn-sm">See Collection</a>
      </div>
    `;
  });

  const pendingList = (pending || []).map(f => `
    <div class="friend-row">
      <span class="friend-av">${f.requester.avatar_emoji}</span>
      <span class="friend-name">${f.requester.username} wants to be friends!</span>
      <button class="btn btn-sm btn-primary" onclick="acceptReq('${f.id}')">Accept</button>
    </div>
  `);

  setView(`
    <div class="friends-screen">
      <h2>👭 Friends</h2>

      ${siblingsHtml}

      <div class="friend-search">
        <input class="field" id="search-input" type="text" placeholder="Search for friends by username…" maxlength="20">
        <button class="btn btn-primary" onclick="searchFriend()">Search</button>
      </div>
      <div id="search-results"></div>

      ${pendingList.length ? `
        <h3>🔔 Requests (${pendingList.length})</h3>
        <div class="friend-list">${pendingList.join('')}</div>
      ` : ''}

      ${friendList.length ? `
        <h3>Other Friends (${friendList.length})</h3>
        <div class="friend-list">${friendList.join('')}</div>
      ` : (!siblings.length ? `<p class="muted">No friends yet — search for someone!</p>` : '')}
    </div>
  `);

  window.acceptReq = async (id) => {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', id);
    toast('Friend added! 🎉', 'success');
    renderFriends();
  };

  window.searchFriend = async () => {
    const q = document.getElementById('search-input').value.trim();
    if (!q) return;
    const siblingIds = state.profiles.map(p => p.id);
    const { data } = await supabase
      .from('profiles')
      .select('id, username, avatar_emoji')
      .ilike('username', `%${q}%`)
      .not('id', 'in', `(${siblingIds.join(',')})`)
      .limit(5);

    const resultsEl = document.getElementById('search-results');
    if (!data || !data.length) {
      resultsEl.innerHTML = '<p class="muted">No one found with that name.</p>';
      return;
    }
    resultsEl.innerHTML = data.map(p => `
      <div class="friend-row">
        <span class="friend-av">${p.avatar_emoji}</span>
        <span class="friend-name">${p.username}</span>
        <button class="btn btn-sm btn-primary" onclick="sendReq('${p.id}')">Add Friend</button>
      </div>
    `).join('');
  };

  window.sendReq = async (toId) => {
    const { error } = await supabase.from('friendships').insert({
      requester_id: myId,
      addressee_id: toId,
    });
    if (error) {
      toast(error.code === '23505' ? 'Already sent!' : 'Oops, try again.', 'error');
    } else {
      toast('Friend request sent! 💌', 'success');
    }
  };
}
