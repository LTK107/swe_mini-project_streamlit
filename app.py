import streamlit as st

st.session_state["runs"] = st.session_state.get("runs", 0) + 1
st.write(f"RUNS={st.session_state['runs']}")

st.text_input("a text input")
st.button("a button")
st.markdown(
    '<div id="plain" tabindex="0" style="padding:8px;border:1px solid #888">'
    "a custom widget</div>",
    unsafe_allow_html=True,
)
