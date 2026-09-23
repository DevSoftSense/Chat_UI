import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Dropdown, DropdownItem, DropdownMenu, DropdownToggle } from 'reactstrap';
import { createSelector } from 'reselect';
import { useSelector } from 'react-redux';

//import images
import avatar1 from "../../assets/images/users/avatar-1.jpg";
import {
  getSessionUserIdentity,
  getSoftOnCloudProfile,
  resolveUserAvatarUrl,
} from "../../helpers/softoncloud_auth_helper";

const ProfileDropdown = () => {


    const profiledropdownData = createSelector(
        (state) => state.Profile,
        (state) => ({
            user: state.user
        })
      );
    // Inside your component
    const {user} = useSelector(profiledropdownData);

    const [userName, setUserName] = useState("");
    const [userRole, setUserRole] = useState("");
    const [avatarSrc, setAvatarSrc] = useState(null);

    useEffect(() => {
        let cancelled = false;
        const applyMe = (me) => {
            if (!me || cancelled) return;
            if (me.displayName) setUserName(me.displayName);
            else if (me.email) setUserName(me.email);
            if (me.jobTitle || me.role) setUserRole(me.jobTitle || me.role);
            setAvatarSrc(resolveUserAvatarUrl(me?.userId, me?.profileImage) || avatar1);
        };

        applyMe(getSessionUserIdentity());

        (async () => {
            try {
                const profile = await getSoftOnCloudProfile();
                if (cancelled || !profile) return;
                applyMe({
                    ...getSessionUserIdentity(),
                    displayName: profile.displayName,
                    email: profile.email,
                    jobTitle: profile.jobTitle,
                    profileImage: profile.profileImageUrl,
                    userId: profile.userId || getSessionUserIdentity().userId,
                });
            } catch {
                // Keep session identity if profile API is unavailable
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [user]);

    useEffect(() => {
        const onAvatarUpdated = (event) => {
            const url = event?.detail?.avatarUrl;
            if (url) setAvatarSrc(url);
        };
        const onProfileUpdated = (event) => {
            const profile = event?.detail?.profile;
            if (!profile) return;
            if (profile.displayName) setUserName(profile.displayName);
            if (profile.jobTitle) setUserRole(profile.jobTitle);
            if (profile.profileImageUrl) setAvatarSrc(profile.profileImageUrl);
        };
        window.addEventListener("chat-profile-avatar-updated", onAvatarUpdated);
        window.addEventListener("chat-profile-updated", onProfileUpdated);
        return () => {
            window.removeEventListener("chat-profile-avatar-updated", onAvatarUpdated);
            window.removeEventListener("chat-profile-updated", onProfileUpdated);
        };
    }, []);

    //Dropdown Toggle
    const [isProfileDropdown, setIsProfileDropdown] = useState(false);
    const toggleProfileDropdown = () => {
        setIsProfileDropdown(!isProfileDropdown);
    };
    return (
        <React.Fragment>
            <Dropdown isOpen={isProfileDropdown} toggle={toggleProfileDropdown} className="ms-sm-3 header-item topbar-user">
                <DropdownToggle tag="button" type="button" className="btn">
                    <span className="d-flex align-items-center">
                        <img className="rounded-circle header-profile-user" src={avatarSrc || avatar1}
                            alt="Header Avatar" />
                        <span className="text-start ms-xl-2">
                            <span className="d-none d-xl-inline-block ms-1 fw-medium user-name-text">{userName || "…"}</span>
                            <span className="d-none d-xl-block ms-1 fs-12 text-muted user-name-sub-text">{userRole || "Member"}</span>
                        </span>
                    </span>
                </DropdownToggle>
                <DropdownMenu className="dropdown-menu-end">
                    <h6 className="dropdown-header">Welcome {userName}!</h6>
                    <DropdownItem className='p-0'>
                        <Link to= "/profile" className="dropdown-item">
                            <i className="mdi mdi-account-circle text-muted fs-16 align-middle me-1"></i>
                            <span className="align-middle">Profile</span>
                        </Link>
                    </DropdownItem>
                    <DropdownItem className='p-0'>
                        <Link to= "/apps-chat" className="dropdown-item">
                            <i className="mdi mdi-message-text-outline text-muted fs-16 align-middle me-1"></i> <span
                                className="align-middle">Messages</span>
                        </Link>
                    </DropdownItem>
                    <DropdownItem className='p-0'>
                        <Link to="#" className="dropdown-item">
                            <i className="mdi mdi-calendar-check-outline text-muted fs-16 align-middle me-1"></i> <span
                                className="align-middle">Taskboard</span>
                        </Link>
                    </DropdownItem>
                    <DropdownItem className='p-0'>
                        <Link to= "/pages-faqs" className="dropdown-item">
                            <i
                                className="mdi mdi-lifebuoy text-muted fs-16 align-middle me-1"></i> <span
                                    className="align-middle">Help</span>
                        </Link>
                    </DropdownItem>
                    <div className="dropdown-divider"></div>
                    <DropdownItem className='p-0'>
                        <Link to= "/pages-profile" className="dropdown-item">
                            <i
                                className="mdi mdi-wallet text-muted fs-16 align-middle me-1"></i> <span
                                    className="align-middle">Balance : <b>$5971.67</b></span>
                        </Link>
                    </DropdownItem >
                    <DropdownItem className='p-0'>
                        <Link to= "/pages-profile-settings" className="dropdown-item">
                            <span
                                className="badge bg-success-subtle text-success mt-1 float-end">New</span><i
                                    className="mdi mdi-cog-outline text-muted fs-16 align-middle me-1"></i> <span
                                        className="align-middle">Settings</span>
                        </Link>
                    </DropdownItem>
                    <DropdownItem className='p-0'>
                        <Link to= "/auth-lockscreen-basic" className="dropdown-item">
                            <i
                                className="mdi mdi-lock text-muted fs-16 align-middle me-1"></i> <span className="align-middle">Lock screen</span>
                        </Link>
                    </DropdownItem>
                    <DropdownItem className='p-0'>
                        <Link to= "/logout" className="dropdown-item">
                            <i
                                className="mdi mdi-logout text-muted fs-16 align-middle me-1"></i> <span
                                    className="align-middle" data-key="t-logout">Logout</span>
                        </Link>
                    </DropdownItem>
                </DropdownMenu>
            </Dropdown>
        </React.Fragment>
    );
};

export default ProfileDropdown;