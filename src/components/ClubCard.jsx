import { Link } from 'react-router-dom';
import ZoomCard from './ZoomCard';
import { majorBreakdown, formatShare } from '../services/recommendations';
// Clicking a club now zooms it into a large centered preview (see




// ZoomCard) instead of navigating straight to the club page - the real
// navigation lives inside the expanded panel as an explicit "Open club
// page" action, same pattern as a Medium article thumbnail.
//
// reason / detail are optional and only passed by the "Recommended for
// you" section on Home (e.g. reason "Liked by others in your major",
// detail "65% of members are CPIS majors") - every other call site is
// unchanged and renders exactly as before.
export default function ClubCard({ club, reason, detail }) {
   const topMajors = majorBreakdown(club, 3);
   return (
     <ZoomCard
       className="club-card"
        ariaLabel={`View ${club.name}`}
        preview={
          <>
            <div className="club-card-header">
              <h3>{club.name}</h3>
              <span className="club-card-count">{club.memberCount || 0} members</span>
            </div>
             <span className="category-dot" style={{ color: 'var(--forest)' }}>{club.category}</span>
             <p className="club-card-desc">{club.description}</p>
          {(club.tags || []).length > 0 && (
            <div className="tag-list">
              {club.tags.slice(0, 3).map((t) => <span key={t} className="tag-chip">#{t}</span>)}
            </div>
          )}
             {reason && <span className="badge recommended-badge">{reason}</span>}
             {detail && <p className="recommended-detail">{detail}</p>}
             {club.requiresApproval && <span className="badge">Requires approval to join</span>}
           </>
       }
        expanded={
          <>
            <h3 className="zoom-panel-title">{club.name}</h3>
            <div className="zoom-panel-meta">
              {club.category} &middot; {club.memberCount || 0} members
             </div>
             <p className="zoom-panel-body">{club.description}</p>
          {(club.tags || []).length > 0 && (
            <div className="tag-list">
              {club.tags.map((t) => <span key={t} className="tag-chip">#{t}</span>)}
            </div>
          )}
             {reason && <span className="badge recommended-badge">{reason}</span>}
             {topMajors.length > 0 && (
               <p className="zoom-panel-body">
                 <strong>Most common majors:</strong>{' '}
                 {topMajors.map((m) => `${m.short} ${formatShare(m.share)}`).join(' · ')}
               </p>
             )}
             {club.requiresApproval && <span className="badge">Requires approval to join</span>}
             <div className="zoom-panel-actions">
               <Link to={`/clubs/${club.id}`}>Open club page &rarr;</Link>
            </div>
          </>
        }
     />
  );
}
